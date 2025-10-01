// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.17;

import "../PendleERC4626NotRedeemableToAssetSY.sol";

/**
 * @title PendleGnodeERC4626SY
 * @notice SY wrapper over an external ERC4626 (asset=NODE, shares=gnode) that never redeems NODE to users.
 *         Deposits may accept NODE or gnode; redemptions always return gnode (vault shares).
 */
contract PendleGnodeERC4626SY is PendleERC4626NotRedeemableToAssetSY {
    constructor(address _externalERC4626)
        PendleERC4626NotRedeemableToAssetSY(
            "SY gnode Vault",
            "SY-gnode",
            _externalERC4626
        )
    {
        require(_externalERC4626 != address(0), "Vault=0");
    }
}


