// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.17;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC4626Upgradeable.sol";

contract GnodeQueue is Initializable, ReentrancyGuardUpgradeable, AccessControlUpgradeable, UUPSUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    ERC4626Upgradeable public vault;  // asset=NODE, shares=gnode
    IERC20Upgradeable public gnode;   // shares
    IERC20Upgradeable public node;    // underlying

    uint256 public minDelay;
    uint256 public epochSize;
    uint256 public epochOutflowLimit;
    uint256 public epochStart;
    uint256 public epochOutflowUsed;   
    uint256 public nextRequestId;

    mapping(uint256 => Request) public requests;

    // Per-user indexing for request IDs
    mapping(address => uint256[]) private _userRequestIds;

    // Storage gap for upgradeability
    uint256[49] private __gap; // reduced by 1 due to _userRequestIds addition

    struct Request { uint256 shares; uint256 earliest; address user; bool claimed; }

    event ParamsUpdated(uint256 minDelay, uint256 epochSize, uint256 epochOutflowLimit);
    event Requested(address indexed user, uint256 id, uint256 shares, uint256 earliest);
    event Claimed(address indexed user, uint256 id, uint256 assetsOut);

    function initialize(address vault_, uint256 minDelay_, uint256 epochSize_, uint256 epochOutflowLimit_, address admin) external initializer {
        require(vault_ != address(0) && admin != address(0), "zero");
        __ReentrancyGuard_init();
        __AccessControl_init();
        __UUPSUpgradeable_init();

        vault = ERC4626Upgradeable(vault_);
        gnode = IERC20Upgradeable(address(vault));
        node = IERC20Upgradeable(vault.asset());

        minDelay = minDelay_;
        epochSize = epochSize_;
        epochOutflowLimit = epochOutflowLimit_;
        epochStart = block.timestamp;

        _setupRole(DEFAULT_ADMIN_ROLE, admin);
        _setupRole(UPGRADER_ROLE, admin);
        _setupRole(OPERATOR_ROLE, admin);
    }

    function setParams(uint256 minDelay_, uint256 epochSize_, uint256 epochOutflowLimit_) external onlyRole(OPERATOR_ROLE) {
        minDelay = minDelay_;
        epochSize = epochSize_;
        epochOutflowLimit = epochOutflowLimit_;
        emit ParamsUpdated(minDelay_, epochSize_, epochOutflowLimit_);
    }

    function _rollEpoch() internal {
        if (block.timestamp >= epochStart + epochSize) {
            epochStart = (block.timestamp / epochSize) * epochSize;
            epochOutflowUsed = 0;
        }
    }

    function requestRedeem(uint256 shares) external nonReentrant returns (uint256 id) {
        require(shares > 0, "zero");
        id = nextRequestId++;
        requests[id] = Request({ shares: shares, earliest: block.timestamp + minDelay, user: msg.sender, claimed: false });
        gnode.safeTransferFrom(msg.sender, address(this), shares);
        _userRequestIds[msg.sender].push(id);
        emit Requested(msg.sender, id, shares, requests[id].earliest);
    }

    function claim(uint256 id, uint256 minAssetsOut) external nonReentrant returns (uint256 assetsOut) {
        Request storage r = requests[id];
        require(!r.claimed && r.user == msg.sender, "bad");
        require(block.timestamp >= r.earliest, "delay");

        _rollEpoch();
        uint256 preview = vault.previewRedeem(r.shares);
        require(epochOutflowUsed + preview <= epochOutflowLimit, "cap");

        gnode.safeApprove(address(vault), 0);
        gnode.safeApprove(address(vault), r.shares);
        assetsOut = vault.redeem(r.shares, msg.sender, address(this));
        require(assetsOut >= minAssetsOut, "slip");
        epochOutflowUsed += assetsOut;

        r.claimed = true;
        emit Claimed(msg.sender, id, assetsOut);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}

    // ======== View helpers (user indexing) ========
    function getUserRequestIds(address user) external view returns (uint256[] memory) {
        return _userRequestIds[user];
    }

    function getUserPendingRequestIds(address user) external view returns (uint256[] memory) {
        uint256[] memory ids = _userRequestIds[user];
        uint256 n = ids.length;
        uint256 pendingCount = 0;
        for (uint256 i = 0; i < n; ) {
            if (!requests[ids[i]].claimed) pendingCount++;
            unchecked { i++; }
        }
        uint256[] memory out = new uint256[](pendingCount);
        uint256 k = 0;
        for (uint256 i = 0; i < n; ) {
            uint256 rid = ids[i];
            if (!requests[rid].claimed) { out[k++] = rid; }
            unchecked { i++; }
        }
        return out;
    }
}


