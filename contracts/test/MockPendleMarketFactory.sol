// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./MockPendleMarket.sol";

contract MockPendleMarketFactory is Ownable {
    event CreateNewMarket(
        address indexed sy,
        uint256 indexed expiry,
        uint256 initialAnchor,
        address market
    );

    mapping(address => mapping(uint256 => address)) public getMarket;
    address[] public allMarkets;

    function createNewMarket(
        address sy,
        uint256 expiry,
        uint256 initialAnchor
    ) external returns (address market) {
        require(sy != address(0), "ZERO_ADDRESS");
        require(expiry > block.timestamp, "INVALID_EXPIRY");
        require(initialAnchor > 0, "INVALID_ANCHOR");
        require(getMarket[sy][expiry] == address(0), "MARKET_EXISTS");

        bytes memory bytecode = type(MockPendleMarket).creationCode;
        bytes32 salt = keccak256(abi.encodePacked(sy, expiry));
        
        assembly {
            market := create2(0, add(bytecode, 32), mload(bytecode), salt)
        }

        MockPendleMarket(market).initialize(sy, expiry, initialAnchor);
        
        getMarket[sy][expiry] = market;
        allMarkets.push(market);

        emit CreateNewMarket(sy, expiry, initialAnchor, market);
    }

    function allMarketsLength() external view returns (uint256) {
        return allMarkets.length;
    }
}
