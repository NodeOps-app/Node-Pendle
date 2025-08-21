import { ethers } from "hardhat";
import { getDeploymentAddress } from "./utils";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Testing with account:", deployer.address);

    // Get deployed contracts
    const mockGnodeAddress = await getDeploymentAddress("MockGnode");
    const vaultAddress = await getDeploymentAddress("GnodeVault");
    
    const mockGnode = await ethers.getContractAt("MockGnodeToken", mockGnodeAddress);
    const vault = await ethers.getContractAt("GnodeERC4626Vault", vaultAddress);

    console.log("\nInitial state:");
    console.log("GNODE balance:", ethers.utils.formatEther(await mockGnode.balanceOf(deployer.address)));
    
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
    
    // Try immediate withdrawal (should fail)
    console.log(`\nTrying to withdraw immediately (should fail)...`);
    try {
        await vault.redeem(shares, deployer.address, deployer.address);
        console.log("WARNING: Withdrawal succeeded when it should have failed!");
    } catch (e) {
        console.log("Withdrawal failed as expected (not mature yet)");
    }

    // Inject some revenue
    const revenueAmount = ethers.utils.parseEther("10");
    console.log(`\nInjecting ${ethers.utils.formatEther(revenueAmount)} GNODE as revenue...`);
    await mockGnode.mint(deployer.address, revenueAmount);
    await vault.injectRevenue(revenueAmount);

    // Check new exchange rate
    const newTotalAssets = await vault.totalAssets();
    const newExchangeRate = await vault.convertToAssets(ethers.utils.parseEther("1"));
    
    console.log(`\nAfter revenue injection:`);
    console.log(`Total assets: ${ethers.utils.formatEther(newTotalAssets)}`);
    console.log(`New exchange rate: ${ethers.utils.formatEther(newExchangeRate)}`);
    console.log(`Value of your shares: ${ethers.utils.formatEther(await vault.convertToAssets(shares))}`);

    console.log("\nTest complete! Wait 1 day before trying to redeem.");
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
