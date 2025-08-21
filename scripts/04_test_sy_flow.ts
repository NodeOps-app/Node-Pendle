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
    
    // Approve SY to spend GNODE
    await mockGnode.approve(sy.address, ethers.constants.MaxUint256);
    console.log("Approved SY to spend GNODE");

    // Test deposit through SY
    const depositAmount = ethers.utils.parseEther("100");
    console.log(`\nDepositing ${ethers.utils.formatEther(depositAmount)} GNODE through SY...`);
    
    await sy.deposit(
        deployer.address,    // receiver
        mockGnodeAddress,    // tokenIn
        depositAmount,       // amount
        0                    // minSharesOut
    );

    // Check balances and shares
    const syBalance = await sy.balanceOf(deployer.address);
    const vaultBalance = await vault.totalAssets();
    const exchangeRate = await sy.exchangeRate();

    console.log(`\nDeposit successful!`);
    console.log(`SY tokens received: ${ethers.utils.formatEther(syBalance)}`);
    console.log(`Total assets in vault: ${ethers.utils.formatEther(vaultBalance)}`);
    console.log(`Current exchange rate: ${ethers.utils.formatEther(exchangeRate)}`);
    
    // Try immediate withdrawal (should fail)
    console.log(`\nTrying to withdraw immediately (should fail)...`);
    try {
        await sy.redeem(
            deployer.address,    // receiver
            syBalance,           // amount
            mockGnodeAddress,    // tokenOut
            0,                   // minAmountOut
            false               // unwrap
        );
        console.log("WARNING: Withdrawal succeeded when it should have failed!");
    } catch (e) {
        console.log("Withdrawal failed as expected (not mature yet)");
    }

    // Inject some revenue (through vault)
    const revenueAmount = ethers.utils.parseEther("10");
    console.log(`\nInjecting ${ethers.utils.formatEther(revenueAmount)} GNODE as revenue...`);
    await mockGnode.mint(deployer.address, revenueAmount);
    await vault.injectRevenue(revenueAmount);

    // Check new rates
    const newExchangeRate = await sy.exchangeRate();
    const syValue = await sy.previewRedeem(mockGnodeAddress, syBalance);
    
    console.log(`\nAfter revenue injection:`);
    console.log(`New exchange rate: ${ethers.utils.formatEther(newExchangeRate)}`);
    console.log(`Value of your SY tokens: ${ethers.utils.formatEther(syValue)}`);

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
