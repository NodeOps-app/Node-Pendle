// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.17;

import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC4626Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title GnodeERC4626Vault
 * @notice ERC4626 vault for GNODE tokens with revenue injection
 * @dev Basic deposit/withdraw, revenue injection, pausing. Maturity handled by Pendle.
 */
contract GnodeERC4626Vault is
    ERC4626Upgradeable,
    ReentrancyGuardUpgradeable,
    AccessControlUpgradeable,
    UUPSUpgradeable
{
    // Roles
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    bytes32 public constant REVENUE_MANAGER_ROLE = keccak256("REVENUE_MANAGER_ROLE");

    // State

    event RevenueInjected(uint256 amount, uint256 newTotalAssets, uint256 newExchangeRate);

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
        require(admin != address(0), "Zero address admin");

        __ERC4626_init(asset_);
        __ERC20_init(name_, symbol_);
        __ReentrancyGuard_init();
        __AccessControl_init();
        __UUPSUpgradeable_init();

        _setupRole(DEFAULT_ADMIN_ROLE, admin);
        _setupRole(UPGRADER_ROLE, admin);
        _setupRole(REVENUE_MANAGER_ROLE, admin);

        // no extra state
    }

    /// @notice Total GNODE managed by vault (simple accounting: actual asset balance)
    function totalAssets() public view virtual override returns (uint256) {
        return IERC20MetadataUpgradeable(asset()).balanceOf(address(this));
    }

    /// @notice Inject revenue to increase share value
    function injectRevenue(uint256 amount) external nonReentrant onlyRole(REVENUE_MANAGER_ROLE) {
        require(amount > 0, "Zero revenue");
        IERC20MetadataUpgradeable(asset()).transferFrom(msg.sender, address(this), amount);
        emit RevenueInjected(amount, totalAssets(), convertToAssets(1e18));
    }

    // No pause logic; rely on role-based revenue injection and ERC4626 default limits

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}
}
