// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract MockPendleMarket is ERC20, ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public sy;
    uint256 public expiry;
    uint256 public initialAnchor;
    bool public initialized;

    // YT balances are tracked separately
    mapping(address => uint256) private _ytBalances;
    uint256 private _ytTotalSupply;

    event Initialize(address sy, uint256 expiry, uint256 initialAnchor);
    event MintPY(address indexed receiver, uint256 netSyUsed, uint256 ptMinted);
    event RedeemPY(address indexed receiver, uint256 ptBurned, uint256 syOut);
    event TransferYT(address indexed from, address indexed to, uint256 amount);

    constructor() ERC20("Pendle PT Mock", "PPTm") {}

    function initialize(
        address _sy,
        uint256 _expiry,
        uint256 _initialAnchor
    ) external {
        require(!initialized, "ALREADY_INITIALIZED");
        require(_sy != address(0), "ZERO_ADDRESS");
        require(_expiry > block.timestamp, "INVALID_EXPIRY");
        require(_initialAnchor > 0, "INVALID_ANCHOR");

        sy = _sy;
        expiry = _expiry;
        initialAnchor = _initialAnchor;
        initialized = true;

        emit Initialize(_sy, _expiry, _initialAnchor);
    }

    function mintPY(
        uint256 netSyToMint,
        address receiver
    ) external nonReentrant returns (uint256 ptMinted) {
        require(block.timestamp < expiry, "EXPIRED");
        
        // For mock: 1:1 ratio for simplicity
        ptMinted = netSyToMint;
        
        // Note: SY tokens are already transferred by the router
        
        _mint(receiver, ptMinted);
        _mintYT(receiver, ptMinted);

        emit MintPY(receiver, netSyToMint, ptMinted);
    }

    function redeemPY(
        uint256 ptToRedeem,
        address receiver
    ) external nonReentrant returns (uint256 syOut) {
        require(block.timestamp >= expiry, "NOT_EXPIRED");
        require(balanceOf(msg.sender) >= ptToRedeem, "INSUFFICIENT_PT");
        require(balanceOfYT(msg.sender) >= ptToRedeem, "INSUFFICIENT_YT");

        // For mock: 1:1 ratio for simplicity
        syOut = ptToRedeem;

        _burn(msg.sender, ptToRedeem);
        _burnYT(msg.sender, ptToRedeem);
        
        IERC20(sy).safeTransfer(receiver, syOut);

        emit RedeemPY(receiver, ptToRedeem, syOut);
    }

    // YT functions
    function balanceOfYT(address account) public view returns (uint256) {
        return _ytBalances[account];
    }

    function totalSupplyYT() public view returns (uint256) {
        return _ytTotalSupply;
    }

    function transferYT(address to, uint256 amount) public returns (bool) {
        address owner = msg.sender;
        _transferYT(owner, to, amount);
        return true;
    }

    function _mintYT(address account, uint256 amount) internal {
        require(account != address(0), "YT: mint to zero");
        _ytTotalSupply += amount;
        _ytBalances[account] += amount;
        emit TransferYT(address(0), account, amount);
    }

    function _burnYT(address account, uint256 amount) internal {
        require(account != address(0), "YT: burn from zero");
        _ytBalances[account] -= amount;
        _ytTotalSupply -= amount;
        emit TransferYT(account, address(0), amount);
    }

    function _transferYT(address from, address to, uint256 amount) internal {
        require(from != address(0), "YT: transfer from zero");
        require(to != address(0), "YT: transfer to zero");

        uint256 fromBalance = _ytBalances[from];
        require(fromBalance >= amount, "YT: insufficient balance");
        
        _ytBalances[from] = fromBalance - amount;
        _ytBalances[to] += amount;

        emit TransferYT(from, to, amount);
    }
}