import { ethers } from "hardhat";
import { getDeploymentAddress } from "./utils";

async function main() {
    // Get all signers for different users
    const [deployer, alice, bob, charlie] = await ethers.getSigners();
    console.log("\nTesting with users:");
    console.log("Alice:", alice.address);
    console.log("Bob:", bob.address);
    console.log("Charlie:", charlie.address);

    // Get deployed contracts
    const mockGnodeAddress = await getDeploymentAddress("MockGnodeV2");
    const vaultAddress = await getDeploymentAddress("GnodeVaultV2");
    const syAddress = await getDeploymentAddress("GnodeSYV2");
    const marketAddress = await getDeploymentAddress("GnodeMarketV2");
    const routerAddress = await getDeploymentAddress("MockPendleRouter");
    
    const mockGnode = await ethers.getContractAt("MockGnodeToken", mockGnodeAddress);
    const vault = await ethers.getContractAt("GnodeERC4626Vault", vaultAddress);
    const sy = await ethers.getContractAt("PendleGnodeERC4626SY", syAddress);
    const market = await ethers.getContractAt("MockPendleMarket", marketAddress);
    const router = await ethers.getContractAt("MockPendleRouter", routerAddress);

    // Mint initial GNODE to users
    console.log("\nMinting initial GNODE to users...");
    const initialGnode = ethers.utils.parseEther("1000");
    await mockGnode.mint(alice.address, initialGnode);
    await mockGnode.mint(bob.address, initialGnode);
    await mockGnode.mint(charlie.address, initialGnode);

    // Users approve SY and Router
    await mockGnode.connect(alice).approve(sy.address, ethers.constants.MaxUint256);
    await mockGnode.connect(bob).approve(sy.address, ethers.constants.MaxUint256);
    await mockGnode.connect(charlie).approve(sy.address, ethers.constants.MaxUint256);

    await sy.connect(alice).approve(routerAddress, ethers.constants.MaxUint256);
    await sy.connect(bob).approve(routerAddress, ethers.constants.MaxUint256);
    await sy.connect(charlie).approve(routerAddress, ethers.constants.MaxUint256);

    // Alice deposits and gets PT/YT
    console.log("\nAlice deposits 100 GNODE and mints PT/YT...");
    const aliceDeposit = ethers.utils.parseEther("100");
    
    // First get SY tokens
    await sy.connect(alice).deposit(
        alice.address,
        mockGnodeAddress,
        aliceDeposit,
        0
    );
    const aliceSyBalance = await sy.balanceOf(alice.address);
    
    // Mint PT/YT
    await router.connect(alice).mintPyFromSy(
        marketAddress,
        aliceSyBalance,
        0,
        alice.address
    );

    console.log("Alice PT balance:", ethers.utils.formatEther(await market.balanceOf(alice.address)));
    console.log("Alice YT balance:", ethers.utils.formatEther(await market.balanceOfYT(alice.address)));

    // Inject some revenue
    console.log("\nInjecting first revenue (10 GNODE)...");
    const revenue1 = ethers.utils.parseEther("10");
    await mockGnode.mint(deployer.address, revenue1);
    await mockGnode.approve(vault.address, revenue1);
    await vault.injectRevenue(revenue1);
    console.log("New exchange rate:", ethers.utils.formatEther(await sy.exchangeRate()));

    // Bob deposits and gets PT/YT
    console.log("\nBob deposits 200 GNODE and mints PT/YT...");
    const bobDeposit = ethers.utils.parseEther("200");
    
    await sy.connect(bob).deposit(
        bob.address,
        mockGnodeAddress,
        bobDeposit,
        0
    );
    const bobSyBalance = await sy.balanceOf(bob.address);
    
    await router.connect(bob).mintPyFromSy(
        marketAddress,
        bobSyBalance,
        0,
        bob.address
    );

    // Alice transfers her YT to Charlie, keeps PT
    console.log("\nAlice transfers YT to Charlie, keeps PT...");
    const aliceYtBalance = await market.balanceOfYT(alice.address);
    await market.connect(alice).transferYT(charlie.address, aliceYtBalance);

    // Bob transfers PT to Charlie, keeps YT
    console.log("\nBob transfers PT to Charlie, keeps YT...");
    const bobPtBalance = await market.balanceOf(bob.address);
    await market.connect(bob).transfer(charlie.address, bobPtBalance.div(2));

    // Inject more revenue
    console.log("\nInjecting second revenue (20 GNODE)...");
    const revenue2 = ethers.utils.parseEther("20");
    await mockGnode.mint(deployer.address, revenue2);
    await mockGnode.approve(vault.address, revenue2);
    await vault.injectRevenue(revenue2);
    console.log("New exchange rate:", ethers.utils.formatEther(await sy.exchangeRate()));

    // Show current positions
    console.log("\nCurrent positions:");
    console.log("Alice:");
    console.log(" PT:", ethers.utils.formatEther(await market.balanceOf(alice.address)));
    console.log(" YT:", ethers.utils.formatEther(await market.balanceOfYT(alice.address)));
    console.log("Bob:");
    console.log(" PT:", ethers.utils.formatEther(await market.balanceOf(bob.address)));
    console.log(" YT:", ethers.utils.formatEther(await market.balanceOfYT(bob.address)));
    console.log("Charlie:");
    console.log(" PT:", ethers.utils.formatEther(await market.balanceOf(charlie.address)));
    console.log(" YT:", ethers.utils.formatEther(await market.balanceOfYT(charlie.address)));

    // Advance time past maturity
    console.log("\nAdvancing time past maturity...");
    await ethers.provider.send("evm_increaseTime", [24 * 60 * 60 + 1]);
    await ethers.provider.send("evm_mine", []);

    // All users redeem
    console.log("\nAll users redeeming PT/YT...");

    // Alice redeems her remaining PT
    const alicePtBalance = await market.balanceOf(alice.address);
    if (alicePtBalance.gt(0)) {
        await market.connect(alice).redeemPY(alicePtBalance, alice.address);
        console.log("Alice redeemed:", ethers.utils.formatEther(alicePtBalance));
    }

    // Bob redeems his remaining PT/YT
    const bobRemainingPt = await market.balanceOf(bob.address);
    const bobRemainingYt = await market.balanceOfYT(bob.address);
    const bobRedeemAmount = bobRemainingPt.lt(bobRemainingYt) ? bobRemainingPt : bobRemainingYt;
    if (bobRedeemAmount.gt(0)) {
        await market.connect(bob).redeemPY(bobRedeemAmount, bob.address);
        console.log("Bob redeemed:", ethers.utils.formatEther(bobRedeemAmount));
    }

    // Charlie redeems his PT/YT
    const charliePt = await market.balanceOf(charlie.address);
    const charlieYt = await market.balanceOfYT(charlie.address);
    const charlieRedeemAmount = charliePt.lt(charlieYt) ? charliePt : charlieYt;
    if (charlieRedeemAmount.gt(0)) {
        await market.connect(charlie).redeemPY(charlieRedeemAmount, charlie.address);
        console.log("Charlie redeemed:", ethers.utils.formatEther(charlieRedeemAmount));
    }

    // Show final GNODE balances
    console.log("\nFinal GNODE balances:");
    console.log("Alice:", ethers.utils.formatEther(await mockGnode.balanceOf(alice.address)));
    console.log("Bob:", ethers.utils.formatEther(await mockGnode.balanceOf(bob.address)));
    console.log("Charlie:", ethers.utils.formatEther(await mockGnode.balanceOf(charlie.address)));
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