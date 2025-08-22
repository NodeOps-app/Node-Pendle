import { ethers } from "hardhat";
import { getDeploymentAddress } from "./utils";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Testing with account:", deployer.address);

    // Get deployed contracts
    const mockGnodeAddress = await getDeploymentAddress("MockGnode");
    const vaultAddress = await getDeploymentAddress("GnodeVault");
    const syAddress = await getDeploymentAddress("GnodeSY");
    
    const mockGnode = await ethers.getContractAt("MockGnodeToken", mockGnodeAddress);
    const vault = await ethers.getContractAt("GnodeERC4626Vault", vaultAddress);
    const sy = await ethers.getContractAt("PendleGnodeERC4626SY", syAddress);

    console.log("\nInitial state:");
    console.log("GNODE balance:", ethers.utils.formatEther(await mockGnode.balanceOf(deployer.address)));
    console.log("SY balance:", ethers.utils.formatEther(await sy.balanceOf(deployer.address)));
    const initialExchangeRate = await sy.exchangeRate();
    console.log("Current exchange rate:", ethers.utils.formatEther(initialExchangeRate));

    // Advance time by 1 day + 1 second
    console.log("\nAdvancing time by 1 day...");
    await ethers.provider.send("evm_increaseTime", [24 * 60 * 60 + 1]);
    await ethers.provider.send("evm_mine", []);

    // Try redemption
    console.log("\nAttempting redemption after maturity...");
    const syBalance = await sy.balanceOf(deployer.address);
    const expectedGnode = await sy.previewRedeem(mockGnodeAddress, syBalance);
    console.log(`Redeeming ${ethers.utils.formatEther(syBalance)} SY tokens`);
    console.log(`Expected GNODE return: ${ethers.utils.formatEther(expectedGnode)}`);

    await sy.redeem(
        deployer.address,    // receiver
        syBalance,           // amount
        mockGnodeAddress,    // tokenOut
        0,                   // minAmountOut
        false               // unwrap
    );

    // Check final state
    const finalGnodeBalance = await mockGnode.balanceOf(deployer.address);
    const finalSyBalance = await sy.balanceOf(deployer.address);

    console.log("\nRedemption successful!");
    console.log("Final GNODE balance:", ethers.utils.formatEther(finalGnodeBalance));
    console.log("Final SY balance:", ethers.utils.formatEther(finalSyBalance));
    console.log("Total value received:", ethers.utils.formatEther(finalGnodeBalance.sub(expectedGnode)));
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}

export default main;
