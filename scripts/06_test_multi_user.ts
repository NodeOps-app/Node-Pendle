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
    const mockGnodeAddress = await getDeploymentAddress("MockGnode");
    const vaultAddress = await getDeploymentAddress("GnodeVault");
    const syAddress = await getDeploymentAddress("GnodeSY");
    
    const mockGnode = await ethers.getContractAt("MockGnodeToken", mockGnodeAddress);
    const vault = await ethers.getContractAt("GnodeERC4626Vault", vaultAddress);
    const sy = await ethers.getContractAt("PendleGnodeERC4626SY", syAddress);

    // Mint initial GNODE to users
    console.log("\nMinting initial GNODE to users...");
    const initialGnode = ethers.utils.parseEther("1000");
    await mockGnode.mint(alice.address, initialGnode);
    await mockGnode.mint(bob.address, initialGnode);
    await mockGnode.mint(charlie.address, initialGnode);

    // Users approve SY
    await mockGnode.connect(alice).approve(sy.address, ethers.constants.MaxUint256);
    await mockGnode.connect(bob).approve(sy.address, ethers.constants.MaxUint256);
    await mockGnode.connect(charlie).approve(sy.address, ethers.constants.MaxUint256);

    // Alice deposits first
    console.log("\nAlice deposits 100 GNODE...");
    const aliceDeposit = ethers.utils.parseEther("100");
    await sy.connect(alice).deposit(
        alice.address,
        mockGnodeAddress,
        aliceDeposit,
        0
    );
    console.log("Alice SY balance:", ethers.utils.formatEther(await sy.balanceOf(alice.address)));

    // Inject some revenue
    console.log("\nInjecting first revenue (10 GNODE)...");
    const revenue1 = ethers.utils.parseEther("10");
    await mockGnode.mint(deployer.address, revenue1);
    await mockGnode.approve(vault.address, revenue1);
    await vault.injectRevenue(revenue1);
    console.log("New exchange rate:", ethers.utils.formatEther(await sy.exchangeRate()));

    // Bob deposits
    console.log("\nBob deposits 200 GNODE...");
    const bobDeposit = ethers.utils.parseEther("200");
    await sy.connect(bob).deposit(
        bob.address,
        mockGnodeAddress,
        bobDeposit,
        0
    );
    console.log("Bob SY balance:", ethers.utils.formatEther(await sy.balanceOf(bob.address)));

    // Simulate PT/YT by splitting SY tokens between users
    console.log("\nSimulating PT/YT transfers...");
    
    // Alice transfers half her SY to Charlie
    const aliceSyBalance = await sy.balanceOf(alice.address);
    const aliceTransfer = aliceSyBalance.div(2);
    await sy.connect(alice).transfer(charlie.address, aliceTransfer);
    console.log("Alice transfers half her SY to Charlie");

    // Bob transfers 1/3 of his SY to Alice
    const bobSyBalance = await sy.balanceOf(bob.address);
    const bobTransfer = bobSyBalance.div(3);
    await sy.connect(bob).transfer(alice.address, bobTransfer);
    console.log("Bob transfers 1/3 of his SY to Alice");

    // Inject more revenue
    console.log("\nInjecting second revenue (20 GNODE)...");
    const revenue2 = ethers.utils.parseEther("20");
    await mockGnode.mint(deployer.address, revenue2);
    await mockGnode.approve(vault.address, revenue2);
    await vault.injectRevenue(revenue2);
    console.log("New exchange rate:", ethers.utils.formatEther(await sy.exchangeRate()));

    // Show current state
    console.log("\nCurrent SY balances:");
    console.log("Alice:", ethers.utils.formatEther(await sy.balanceOf(alice.address)));
    console.log("Bob:", ethers.utils.formatEther(await sy.balanceOf(bob.address)));
    console.log("Charlie:", ethers.utils.formatEther(await sy.balanceOf(charlie.address)));

    // Advance time past maturity
    console.log("\nAdvancing time past maturity...");
    await ethers.provider.send("evm_increaseTime", [24 * 60 * 60 + 1]);
    await ethers.provider.send("evm_mine", []);

    // All users redeem
    console.log("\nAll users redeeming...");

    // Alice redeems
    const aliceFinalSy = await sy.balanceOf(alice.address);
    if (aliceFinalSy.gt(0)) {
        await sy.connect(alice).redeem(
            alice.address,
            aliceFinalSy,
            mockGnodeAddress,
            0,
            false
        );
    }

    // Bob redeems
    const bobFinalSy = await sy.balanceOf(bob.address);
    if (bobFinalSy.gt(0)) {
        await sy.connect(bob).redeem(
            bob.address,
            bobFinalSy,
            mockGnodeAddress,
            0,
            false
        );
    }

    // Charlie redeems
    const charlieFinalSy = await sy.balanceOf(charlie.address);
    if (charlieFinalSy.gt(0)) {
        await sy.connect(charlie).redeem(
            charlie.address,
            charlieFinalSy,
            mockGnodeAddress,
            0,
            false
        );
    }

    // Show final GNODE balances
    console.log("\nFinal GNODE balances:");
    console.log("Alice:", ethers.utils.formatEther(await mockGnode.balanceOf(alice.address)));
    console.log("Bob:", ethers.utils.formatEther(await mockGnode.balanceOf(bob.address)));
    console.log("Charlie:", ethers.utils.formatEther(await mockGnode.balanceOf(charlie.address)));

    // Calculate total value created
    const totalGnodeOut = (await mockGnode.balanceOf(alice.address))
        .add(await mockGnode.balanceOf(bob.address))
        .add(await mockGnode.balanceOf(charlie.address))
        .sub(initialGnode.mul(3));  // Subtract initial mints
    
    console.log("\nTotal value created:", ethers.utils.formatEther(totalGnodeOut));
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
