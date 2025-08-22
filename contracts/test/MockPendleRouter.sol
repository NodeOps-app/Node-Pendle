// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./MockPendleMarket.sol";

contract MockPendleRouter {
    using SafeERC20 for IERC20;

    event MintPyFromSy(
        address indexed market,
        uint256 netSyUsed,
        uint256 ptMinted,
        address indexed receiver
    );

    function mintPyFromSy(
        address market,
        uint256 netSyToMint,
        uint256 minPtOut,
        address receiver
    ) external returns (uint256 ptMinted) {
        require(market != address(0), "ZERO_ADDRESS");
        
        MockPendleMarket pendleMarket = MockPendleMarket(market);
        address sy = pendleMarket.sy();
        
        // Transfer SY from user to market
        IERC20(sy).safeTransferFrom(msg.sender, market, netSyToMint);
        
        // Mint PT/YT
        ptMinted = pendleMarket.mintPY(netSyToMint, receiver);
        require(ptMinted >= minPtOut, "INSUFFICIENT_PT_OUT");

        emit MintPyFromSy(market, netSyToMint, ptMinted, receiver);
    }
}
