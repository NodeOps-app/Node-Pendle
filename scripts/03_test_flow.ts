import { ethers } from "hardhat";
import { getDeploymentAddress } from "./utils";

async function main() {
    // Get deployed contracts
    const mockGnodeAddress = await getDeploymentAddress("MockGnode");
    const vaultAddress = await getDeploymentAddress("GnodeVault");
    const syAddress = await getDeploymentAddress("GnodeSY");

    const mockGnode = await ethers.getContractAt("MockGnodeToken", mockGnodeAddress);
    const vault = await ethers.getContractAt("GnodeERC4626Vault", vaultAddress);
    const sy = await ethers.getContractAt("PendleGnodeERC4626SY", syAddress);

    // Get signers
    const [deployer, user1, user2] = await ethers.getSigners();

    console.log("Testing basic flow...");

    // 1. Mint some GNODE to users
    const mintAmount = ethers.utils.parseEther("100");
    await mockGnode.mint(user1.address, mintAmount);
    await mockGnode.mint(user2.address, mintAmount);
    console.log("Minted GNODE to users");

    // 2. User1 deposits GNODE
    await mockGnode.connect(user1).approve(sy.address, mintAmount);
    await sy.connect(user1).deposit(
        user1.address,
        mockGnode.address,
        mintAmount,
        0 // minSharesOut
    );
    console.log("User1 deposited GNODE");

    // 3. Check balances and exchange rate
    const user1Shares = await sy.balanceOf(user1.address);
    const exchangeRate = await sy.exchangeRate();
    console.log(`User1 shares: ${ethers.utils.formatEther(user1Shares)}`);
    console.log(`Exchange rate: ${ethers.utils.formatEther(exchangeRate)}`);

    // 4. Inject some revenue
    const revenueAmount = ethers.utils.parseEther("10");
    await mockGnode.mint(deployer.address, revenueAmount);
    await mockGnode.approve(vault.address, revenueAmount);
    await vault.injectRevenue(revenueAmount);
    console.log("Injected revenue");

    // 5. Check new exchange rate
    const newExchangeRate = await sy.exchangeRate();
    console.log(`New exchange rate: ${ethers.utils.formatEther(newExchangeRate)}`);

    // 6. User2 deposits after revenue
    await mockGnode.connect(user2).approve(sy.address, mintAmount);
    await sy.connect(user2).deposit(
        user2.address,
        mockGnode.address,
        mintAmount,
        0 // minSharesOut
    );
    console.log("User2 deposited GNODE");

    const user2Shares = await sy.balanceOf(user2.address);
    console.log(`User2 shares: ${ethers.utils.formatEther(user2Shares)}`);

    // 7. Try to redeem (should fail due to maturity)
    try {
        await sy.connect(user1).redeem(
            user1.address,
            user1Shares,
            mockGnode.address,
            0,
            false
        );
        console.log("WARNING: Redemption succeeded when it should fail");
    } catch (e) {
        console.log("Redemption failed as expected (not mature)");
    }

    // 8. Advance time (for testing)
    await ethers.provider.send("evm_increaseTime", [366 * 24 * 60 * 60]); // 366 days
    await ethers.provider.send("evm_mine", []);
    console.log("Advanced time past maturity");

    // 9. Try redeem again
    await sy.connect(user1).redeem(
        user1.address,
        user1Shares,
        mockGnode.address,
        0,
        false
    );
    console.log("User1 redeemed after maturity");

    // 10. Final balances
    const finalGnodeBalance = await mockGnode.balanceOf(user1.address);
    console.log(`User1 final GNODE balance: ${ethers.utils.formatEther(finalGnodeBalance)}`);
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
