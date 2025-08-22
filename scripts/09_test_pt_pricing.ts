import { ethers } from "hardhat";
import { getDeploymentAddress } from "./utils";

async function main() {
    const [deployer, alice, bob, charlie] = await ethers.getSigners();
    console.log("\nTesting PT pricing scenarios:");

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

    // Initial setup
    console.log("\nInitial Setup:");
    const aliceDeposit = ethers.utils.parseEther("100");
    await mockGnode.mint(alice.address, aliceDeposit);
    await mockGnode.connect(alice).approve(sy.address, aliceDeposit);
    await sy.connect(alice).approve(routerAddress, aliceDeposit);

    // Alice deposits and gets PT/YT
    await sy.connect(alice).deposit(alice.address, mockGnodeAddress, aliceDeposit, 0);
    await router.connect(alice).mintPyFromSy(marketAddress, aliceDeposit, 0, alice.address);

    console.log("Alice initial position:");
    console.log(" PT:", ethers.utils.formatEther(await market.balanceOf(alice.address)));
    console.log(" YT:", ethers.utils.formatEther(await market.balanceOfYT(alice.address)));

    // Scenario 1: Sell YT early
    console.log("\nScenario 1: Sell YT early");
    const ytPrice = ethers.utils.parseEther("10"); // YT worth 10 GNODE
    await mockGnode.mint(charlie.address, ytPrice);
    await mockGnode.connect(charlie).approve(market.address, ytPrice);
    await market.connect(alice).transferYT(charlie.address, await market.balanceOfYT(alice.address));
    await mockGnode.connect(charlie).transfer(alice.address, ytPrice);
    
    console.log("Alice after selling YT:");
    console.log(" PT:", ethers.utils.formatEther(await market.balanceOf(alice.address)));
    console.log(" YT:", ethers.utils.formatEther(await market.balanceOfYT(alice.address)));
    console.log(" GNODE:", ethers.utils.formatEther(await mockGnode.balanceOf(alice.address)));

    // Scenario 2: Hold PT for a while (25% of duration)
    console.log("\nScenario 2: Hold PT for 25% of duration");
    await ethers.provider.send("evm_increaseTime", [24 * 60 * 60 * 90]); // 90 days
    await ethers.provider.send("evm_mine", []);

    // Simulate PT price appreciation
    const ptPrice = ethers.utils.parseEther("97"); // PT now worth 97 GNODE
    await mockGnode.mint(bob.address, ptPrice);
    await mockGnode.connect(bob).approve(market.address, ptPrice);
    await market.connect(alice).transfer(bob.address, await market.balanceOf(alice.address));
    await mockGnode.connect(bob).transfer(alice.address, ptPrice);

    console.log("Alice after selling PT:");
    console.log(" PT:", ethers.utils.formatEther(await market.balanceOf(alice.address)));
    console.log(" YT:", ethers.utils.formatEther(await market.balanceOfYT(alice.address)));
    console.log(" GNODE:", ethers.utils.formatEther(await mockGnode.balanceOf(alice.address)));

    // Final profit calculation
    const finalGnodeBalance = await mockGnode.balanceOf(alice.address);
    const profit = finalGnodeBalance.sub(aliceDeposit);
    console.log("\nAlice's total profit:", ethers.utils.formatEther(profit), "GNODE");
    console.log("(From: YT sale + PT price appreciation)");
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
