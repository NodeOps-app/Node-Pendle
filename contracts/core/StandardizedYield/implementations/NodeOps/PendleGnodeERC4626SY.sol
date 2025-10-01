// // SPDX-License-Identifier: GPL-3.0-or-later
// pragma solidity ^0.8.17;

// import "../PendleERC4626SY.sol";

// /**
//  * @title PendleGnodeERC4626SY
//  * @notice Standardized Yield (SY) wrapper for GNODE vault
//  * @dev This contract makes the GNODE vault compatible with Pendle's market system
//  */
// contract PendleGnodeERC4626SY is PendleERC4626SY {
//     /**
//      * @notice Create a new SY token for GNODE vault
//      * @param _gnodeVault Address of the GNODE ERC4626 vault
//      */
//     constructor(
//         address _gnodeVault
//     ) PendleERC4626SY(
//         "Pendle Gnode Yield Token",
//         "SY-GNODE",
//         _gnodeVault
//     ) {
//         require(_gnodeVault != address(0), "Zero vault address");
//     }
// }