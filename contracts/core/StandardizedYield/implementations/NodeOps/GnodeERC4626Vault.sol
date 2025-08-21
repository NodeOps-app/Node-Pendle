// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.17;

import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC4626Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

contract GnodeERC4626Vault is 
    ERC4626Upgradeable,
    ReentrancyGuardUpgradeable,
    AccessControlUpgradeable,
    UUPSUpgradeable
{
    using Math for uint256;

    struct DepositInfo {
        uint256 shares;          // Amount of shares (not assets)
        uint256 maturityTime;    // When this deposit becomes redeemable
    }

    // Events
    event RevenueInjected(uint256 amount, uint256 newTotalAssets, uint256 newExchangeRate);
    event DepositMaturitySet(address indexed user, uint256 depositId, uint256 maturityTime);

    // Roles
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    bytes32 public constant REVENUE_MANAGER_ROLE = keccak256("REVENUE_MANAGER_ROLE");
    bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    // Constants
    uint256 public constant MATURITY_PERIOD = 1 days;
    
    // State variables
    mapping(address => DepositInfo[]) public userDeposits;
    uint256 private _totalAssetManaged;    // Total GNODE including revenue
    bool public paused;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        IERC20MetadataUpgradeable asset_,
        string memory name_,
        string memory symbol_,
        address admin
    ) public initializer {
        __ERC4626_init(asset_);
        __ERC20_init(name_, symbol_);
        __ReentrancyGuard_init();
        __AccessControl_init();
        __UUPSUpgradeable_init();

        // Setup roles
        _setupRole(DEFAULT_ADMIN_ROLE, admin);
        _setupRole(UPGRADER_ROLE, admin);
        _setupRole(REVENUE_MANAGER_ROLE, admin);
        _setupRole(EMERGENCY_ROLE, admin);
        _setupRole(PAUSER_ROLE, admin);
    }

    function totalAssets() public view virtual override returns (uint256) {
        return _totalAssetManaged;
    }

    function _deposit(
        address caller,
        address receiver,
        uint256 assets,
        uint256 shares
    ) internal virtual override {
        require(!paused, "Contract is paused");

        // Record deposit with maturity
        userDeposits[receiver].push(DepositInfo({
            shares: shares,
            maturityTime: block.timestamp + MATURITY_PERIOD
        }));

        emit DepositMaturitySet(receiver, userDeposits[receiver].length - 1, block.timestamp + MATURITY_PERIOD);

        // Handle tokens
        super._deposit(caller, receiver, assets, shares);
        _totalAssetManaged += assets;
    }

    function _withdraw(
        address caller,
        address receiver,
        address owner,
        uint256 assets,
        uint256 shares
    ) internal virtual override {
        require(!paused, "Contract is paused");
        require(_processMatureShares(owner, shares), "No mature shares");

        _totalAssetManaged -= assets;
        super._withdraw(caller, receiver, owner, assets, shares);
    }

    function injectRevenue(uint256 amount) external nonReentrant onlyRole(REVENUE_MANAGER_ROLE) {
        require(!paused, "Contract is paused");
        require(amount > 0, "Zero revenue");
        
        // Transfer revenue tokens to this contract
        IERC20MetadataUpgradeable(asset()).transferFrom(msg.sender, address(this), amount);
        
        _totalAssetManaged += amount;

        emit RevenueInjected(
            amount,
            _totalAssetManaged,
            convertToAssets(1e18)
        );
    }

    function _processMatureShares(address owner, uint256 sharesToRedeem) internal returns (bool) {
        uint256 remainingShares = sharesToRedeem;
        DepositInfo[] storage deposits = userDeposits[owner];
        
        for (uint256 i = 0; i < deposits.length && remainingShares > 0; i++) {
            DepositInfo storage depositRecord = deposits[i];
            
            if (depositRecord.shares > 0 && block.timestamp >= depositRecord.maturityTime) {
                uint256 redeemable = Math.min(depositRecord.shares, remainingShares);
                depositRecord.shares -= redeemable;
                remainingShares -= redeemable;
            }
        }
        
        return remainingShares == 0;
    }

    function maxDeposit(address) public view virtual override returns (uint256) {
        return paused ? 0 : type(uint256).max;
    }

    function maxMint(address) public view virtual override returns (uint256) {
        return paused ? 0 : type(uint256).max;
    }

    function maxWithdraw(address owner) public view virtual override returns (uint256) {
        return paused ? 0 : _getRedeemableAssets(owner);
    }

    function maxRedeem(address owner) public view virtual override returns (uint256) {
        return paused ? 0 : _getRedeemableShares(owner);
    }

    function _getRedeemableShares(address owner) internal view returns (uint256 redeemable) {
        DepositInfo[] storage deposits = userDeposits[owner];
        
        for (uint256 i = 0; i < deposits.length; i++) {
            if (block.timestamp >= deposits[i].maturityTime) {
                redeemable += deposits[i].shares;
            }
        }
    }

    function _getRedeemableAssets(address owner) internal view returns (uint256) {
        return convertToAssets(_getRedeemableShares(owner));
    }

    function getUserDeposits(address user) external view returns (
        uint256[] memory shareAmounts,
        uint256[] memory maturityTimes,
        uint256[] memory assetAmounts
    ) {
        DepositInfo[] storage deposits = userDeposits[user];
        uint256 length = deposits.length;
        
        shareAmounts = new uint256[](length);
        maturityTimes = new uint256[](length);
        assetAmounts = new uint256[](length);
        
        for (uint256 i = 0; i < length; i++) {
            shareAmounts[i] = deposits[i].shares;
            maturityTimes[i] = deposits[i].maturityTime;
            assetAmounts[i] = convertToAssets(deposits[i].shares);
        }
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}
}