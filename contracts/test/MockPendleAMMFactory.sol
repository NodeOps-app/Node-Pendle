// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./MockPendleAMM.sol";

contract MockPendleAMMFactory is Ownable {
    enum PoolType { PT_TOKEN, YT_TOKEN, PT_YT }

    event CreatePool(
        address indexed token0,
        address indexed token1,
        PoolType poolType,
        address pool
    );

    mapping(address => mapping(address => address)) public getPool;
    address[] public allPools;

    function createPool(
        address token0,
        address token1,
        PoolType poolType
    ) external returns (address pool) {
        require(token0 != address(0), "ZERO_ADDRESS");
        require(token1 != address(0), "ZERO_ADDRESS");
        require(token0 != token1, "IDENTICAL_ADDRESSES");
        require(getPool[token0][token1] == address(0), "POOL_EXISTS");

        bytes memory bytecode = type(MockPendleAMM).creationCode;
        bytes32 salt = keccak256(abi.encodePacked(token0, token1, uint8(poolType)));
        
        assembly {
            pool := create2(0, add(bytecode, 32), mload(bytecode), salt)
        }

        MockPendleAMM(pool).initialize(token0, token1);
        
        getPool[token0][token1] = pool;
        getPool[token1][token0] = pool; // populate reverse mapping
        allPools.push(pool);

        emit CreatePool(token0, token1, poolType, pool);
    }

    function allPoolsLength() external view returns (uint256) {
        return allPools.length;
    }
}
