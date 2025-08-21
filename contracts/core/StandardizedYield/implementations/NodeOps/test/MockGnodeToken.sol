// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MockGnodeToken is ERC20, Ownable {
    constructor() ERC20("Mock Gnode Token", "GNODE") {}

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
