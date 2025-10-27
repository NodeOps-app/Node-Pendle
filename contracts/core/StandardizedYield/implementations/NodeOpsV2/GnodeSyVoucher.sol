// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.17;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";

interface ISyRedeem {
    function redeem(address receiver, uint256 amountShares, address tokenOut, uint256 minOut, bool /*unused*/)
        external
        returns (uint256);
}

/**
 * @title GnodeSyVoucher (upgradeable)
 * @notice Custody contract to allocate SY to users based on off-chain EIP-712 signatures from a trusted signer.
 *         - Holds or pulls SY from a treasury
 *         - On valid signature, transfers SY to user, or redeems SY -> gnode to user
 *         - Never outputs NODE; NODE exits still go through the external queue
 */
contract GnodeSyVoucher is Initializable, UUPSUpgradeable, AccessControlUpgradeable, ReentrancyGuardUpgradeable, EIP712Upgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    // External contracts
    address public sy;        // PendleGnodeERC4626SY (ERC20)
    address public vault;     // GnodeVault (ERC4626 shares token address as tokenOut)
    address public treasury;  // Source of SY if contract balance is insufficient
    address public trustedSigner; // EIP-712 signer

    // nonces / replay protection
    mapping(bytes32 => bool) public usedVoucher;

    // keccak256("Claim(address user,address receiver,uint256 syAmount,uint256 nonce,uint256 deadline,bool redeemToGnode)")
    bytes32 public constant CLAIM_TYPEHASH = 0x7a39d232c1c856b7be2e4b2cf5a0c2c3a92459f8c3333191f3065ca2e5d43374;

    event ClaimedSy(address indexed user, address indexed receiver, uint256 syAmount);
    event ClaimedGnode(address indexed user, address indexed receiver, uint256 syAmount);
    event SignerUpdated(address signer);
    event TreasuryUpdated(address treasury);

    struct ClaimVoucher {
        address user;
        address receiver;
        uint256 syAmount;
        uint256 nonce;
        uint256 deadline;
        bool redeemToGnode;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address sy_, address vault_, address treasury_, address signer_, address admin_) external initializer {
        require(sy_ != address(0) && vault_ != address(0) && admin_ != address(0), "zero");

        __EIP712_init("GnodeSyVoucher", "1");
        __UUPSUpgradeable_init();
        __AccessControl_init();
        __ReentrancyGuard_init();

        sy = sy_;
        vault = vault_;
        treasury = treasury_;
        trustedSigner = signer_;

        _setupRole(DEFAULT_ADMIN_ROLE, admin_);
        _setupRole(UPGRADER_ROLE, admin_);
        _setupRole(OPERATOR_ROLE, admin_);
    }

    function setTrustedSigner(address signer_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        trustedSigner = signer_;
        emit SignerUpdated(signer_);
    }

    function setTreasury(address treasury_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        treasury = treasury_;
        emit TreasuryUpdated(treasury_);
    }

    function claim(ClaimVoucher calldata v, bytes calldata signature) external nonReentrant {
        require(v.user == msg.sender, "not user");
        require(block.timestamp <= v.deadline, "expired");

        bytes32 structHash = keccak256(abi.encode(
            CLAIM_TYPEHASH,
            v.user,
            v.receiver,
            v.syAmount,
            v.nonce,
            v.deadline,
            v.redeemToGnode
        ));
        bytes32 digest = _hashTypedDataV4(structHash);
        require(!usedVoucher[digest], "used");
        require(trustedSigner != address(0), "signer=0");
        address signer = ECDSAUpgradeable.recover(digest, signature);
        require(signer == trustedSigner, "bad sig");
        usedVoucher[digest] = true;

        // Ensure SY is available in this contract; if insufficient, pull from treasury
        IERC20Upgradeable syToken = IERC20Upgradeable(sy);
        uint256 bal = syToken.balanceOf(address(this));
        if (bal < v.syAmount) {
            require(treasury != address(0), "treasury=0");
            syToken.safeTransferFrom(treasury, address(this), v.syAmount - bal);
        }

        if (v.redeemToGnode) {
            // redeem SY -> gnode to receiver; tokenOut is the vault (shares token)
            ISyRedeem(sy).redeem(v.receiver, v.syAmount, vault, 0, false);
            emit ClaimedGnode(v.user, v.receiver, v.syAmount);
        } else {
            syToken.safeTransfer(v.receiver, v.syAmount);
            emit ClaimedSy(v.user, v.receiver, v.syAmount);
        }
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}

    uint256[50] private __gap;
}


