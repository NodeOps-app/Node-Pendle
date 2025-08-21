// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.17;

import "../PendleERC4626SY.sol";

contract PendleGnodeERC4626SY is PendleERC4626SY {
    constructor(address _gnodeVault) PendleERC4626SY("Pendle Gnode Yield Token", "SY-GNODE", _gnodeVault) {}
}