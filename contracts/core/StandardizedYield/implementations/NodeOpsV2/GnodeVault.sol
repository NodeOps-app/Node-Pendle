// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.17;

import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC4626Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/draft-ERC20PermitUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title GnodeVault (ERC4626)
 * @notice External ERC4626 vault with asset = NODE and shares = gnode (non-rebasing).
 *         Withdraw/redeem are restricted to QUEUE_ROLE to enforce external queue/lock policy.
 *         Deposits/mints are permissionless. Revenue can be donated (asset in, no shares minted).
 */
contract GnodeVault is
    ERC4626Upgradeable,
    ERC20PermitUpgradeable,
    ReentrancyGuardUpgradeable,
    AccessControlUpgradeable,
    UUPSUpgradeable
{
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    bytes32 public constant QUEUE_ROLE = keccak256("QUEUE_ROLE");

    event RevenueAdded(uint256 amount, uint256 totalAssetsAfter, uint256 exchangeRate);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        IERC20MetadataUpgradeable asset_,
        string memory name_,
        string memory symbol_,
        address admin
    ) external initializer {
        require(address(asset_) != address(0), "Asset=0");
        require(admin != address(0), "Admin=0");

        __ERC4626_init(asset_);
        __ERC20_init(name_, symbol_);
        __ERC20Permit_init(name_);
        __ReentrancyGuard_init();
        __AccessControl_init();
        __UUPSUpgradeable_init();

        _setupRole(DEFAULT_ADMIN_ROLE, admin);
        _setupRole(UPGRADER_ROLE, admin);
        _setupRole(QUEUE_ROLE, admin);
    }

    function totalAssets() public view virtual override returns (uint256) {
        return IERC20MetadataUpgradeable(asset()).balanceOf(address(this));
    }

    function donateRevenue(uint256 amount) external nonReentrant {
        require(amount > 0, "Zero");
        IERC20MetadataUpgradeable(asset()).transferFrom(msg.sender, address(this), amount);
        emit RevenueAdded(amount, totalAssets(), convertToAssets(1e18));
    }

    // Resolve multiple inheritance of decimals()
    function decimals()
        public
        view
        virtual
        override(ERC20Upgradeable, ERC4626Upgradeable)
        returns (uint8)
    {
        return super.decimals();
    }

    function withdraw(
        uint256 assets,
        address receiver,
        address owner
    ) public virtual override onlyRole(QUEUE_ROLE) nonReentrant returns (uint256 shares) {
        return super.withdraw(assets, receiver, owner);
    }

    function redeem(
        uint256 shares,
        address receiver,
        address owner
    ) public virtual override onlyRole(QUEUE_ROLE) nonReentrant returns (uint256 assets) {
        return super.redeem(shares, receiver, owner);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}
}


