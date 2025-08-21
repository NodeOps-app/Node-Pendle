import { ethers } from "hardhat";
import { getDeploymentAddress } from "./utils";

async function main() {
    const mockGnodeAddress = await getDeploymentAddress("MockGnode");
    const vaultAddress = await getDeploymentAddress("GnodeVault");
    
    const mockGnode = await ethers.getContractAt("MockGnodeToken", mockGnodeAddress);
    const vault = await ethers.getContractAt("GnodeERC4626Vault", vaultAddress);
    
    const [deployer] = await ethers.getSigners();

    // Test deposit
    const depositAmount = ethers.utils.parseEther("100");
    console.log(`\nDepositing ${ethers.utils.formatEther(depositAmount)} GNODE...`);
    
    const tx = await vault.deposit(depositAmount, deployer.address);
    await tx.wait();

    // Check balances and shares
    const shares = await vault.balanceOf(deployer.address);
    const totalAssets = await vault.totalAssets();
    const depositInfo = await vault.getUserDeposits(deployer.address);

    console.log(`\nDeposit successful!`);
    console.log(`Shares received: ${ethers.utils.formatEther(shares)}`);
    console.log(`Total assets in vault: ${ethers.utils.formatEther(totalAssets)}`);
    console.log(`Maturity timestamp: ${depositInfo.maturityTimes[0].toString()}`);
    
    // Try immediate withdrawal (should fail due to maturity)
    console.log(`\nTrying to withdraw immediately (should fail)...`);
    try {
        await vault.redeem(shares, deployer.address, deployer.address);
        console.log("WARNING: Withdrawal succeeded when it should have failed!");
    } catch (e) {
        console.log("Withdrawal failed as expected (not mature yet)");
    }
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
