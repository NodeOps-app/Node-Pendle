// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract MockPendleAMM is ERC20, ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public token0;
    address public token1;
    bool public initialized;

    uint256 public reserve0;
    uint256 public reserve1;

    event AddLiquidity(address indexed provider, uint256 amount0, uint256 amount1, uint256 lpMinted);
    event RemoveLiquidity(address indexed provider, uint256 lpAmount, uint256 amount0, uint256 amount1);
    event Swap(address indexed sender, address tokenIn, uint256 amountIn, address tokenOut, uint256 amountOut);

    constructor() ERC20("Mock Pendle LP", "MPLP") {}

    function initialize(address _token0, address _token1) external {
        require(!initialized, "ALREADY_INITIALIZED");
        require(_token0 != address(0) && _token1 != address(0), "ZERO_ADDRESS");
        token0 = _token0;
        token1 = _token1;
        initialized = true;
    }

    function addLiquidity(
        uint256 amount0Desired,
        uint256 amount1Desired,
        uint256 minLpOut
    ) external nonReentrant returns (uint256 lpMinted) {
        require(initialized, "NOT_INITIALIZED");

        // Transfer tokens from sender
        IERC20(token0).safeTransferFrom(msg.sender, address(this), amount0Desired);
        IERC20(token1).safeTransferFrom(msg.sender, address(this), amount1Desired);

        uint256 balance0 = IERC20(token0).balanceOf(address(this));
        uint256 balance1 = IERC20(token1).balanceOf(address(this));

        if (reserve0 == 0 && reserve1 == 0) {
            // First liquidity provider
            lpMinted = _sqrt(amount0Desired * amount1Desired);
        } else {
            uint256 amount0 = balance0 - reserve0;
            uint256 amount1 = balance1 - reserve1;
            
            if (amount0 * reserve1 < amount1 * reserve0) {
                lpMinted = (amount0 * totalSupply()) / reserve0;
            } else {
                lpMinted = (amount1 * totalSupply()) / reserve1;
            }
        }

        require(lpMinted >= minLpOut, "INSUFFICIENT_LP_OUT");
        
        reserve0 = balance0;
        reserve1 = balance1;
        _mint(msg.sender, lpMinted);

        emit AddLiquidity(msg.sender, amount0Desired, amount1Desired, lpMinted);
    }

    function removeLiquidity(
        uint256 lpAmount,
        uint256 min0Out,
        uint256 min1Out
    ) external nonReentrant returns (uint256 amount0, uint256 amount1) {
        require(initialized, "NOT_INITIALIZED");
        require(lpAmount > 0, "ZERO_AMOUNT");

        uint256 totalLPSupply = totalSupply();
        amount0 = (lpAmount * reserve0) / totalLPSupply;
        amount1 = (lpAmount * reserve1) / totalLPSupply;

        require(amount0 >= min0Out, "INSUFFICIENT_TOKEN0_OUT");
        require(amount1 >= min1Out, "INSUFFICIENT_TOKEN1_OUT");

        _burn(msg.sender, lpAmount);
        IERC20(token0).safeTransfer(msg.sender, amount0);
        IERC20(token1).safeTransfer(msg.sender, amount1);

        reserve0 -= amount0;
        reserve1 -= amount1;

        emit RemoveLiquidity(msg.sender, lpAmount, amount0, amount1);
    }

    function swap0For1(
        uint256 amountIn,
        uint256 minAmountOut
    ) external nonReentrant returns (uint256 amountOut) {
        require(initialized, "NOT_INITIALIZED");
        require(amountIn > 0, "ZERO_AMOUNT");

        IERC20(token0).safeTransferFrom(msg.sender, address(this), amountIn);

        uint256 balance0After = reserve0 + amountIn;
        uint256 balance1After = (reserve0 * reserve1) / balance0After;
        amountOut = reserve1 - balance1After;

        require(amountOut >= minAmountOut, "INSUFFICIENT_OUTPUT");

        IERC20(token1).safeTransfer(msg.sender, amountOut);

        reserve0 = balance0After;
        reserve1 = balance1After;

        emit Swap(msg.sender, token0, amountIn, token1, amountOut);
    }

    function swap1For0(
        uint256 amountIn,
        uint256 minAmountOut
    ) external nonReentrant returns (uint256 amountOut) {
        require(initialized, "NOT_INITIALIZED");
        require(amountIn > 0, "ZERO_AMOUNT");

        IERC20(token1).safeTransferFrom(msg.sender, address(this), amountIn);

        uint256 balance1After = reserve1 + amountIn;
        uint256 balance0After = (reserve0 * reserve1) / balance1After;
        amountOut = reserve0 - balance0After;

        require(amountOut >= minAmountOut, "INSUFFICIENT_OUTPUT");

        IERC20(token0).safeTransfer(msg.sender, amountOut);

        reserve1 = balance1After;
        reserve0 = balance0After;

        emit Swap(msg.sender, token1, amountIn, token0, amountOut);
    }

    function _sqrt(uint256 y) private pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }
}