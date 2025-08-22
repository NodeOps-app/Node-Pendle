import { ethers, upgrades } from "hardhat";
import { saveDeployment } from "./utils";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with account:", deployer.address);

    // 1. Deploy Mock GNODE
    console.log("\nDeploying Mock GNODE...");
    const MockGnode = await ethers.getContractFactory("MockGnodeToken");
    const mockGnode = await MockGnode.deploy();
    await mockGnode.deployed();
    console.log("MockGnode deployed to:", mockGnode.address);
    await saveDeployment("MockGnodeV2", mockGnode.address);

    // 2. Deploy Vault
    console.log("\nDeploying Vault...");
    const GnodeVault = await ethers.getContractFactory("GnodeERC4626Vault");
    const vault = await upgrades.deployProxy(
        GnodeVault,
        [
            mockGnode.address,
            "Gnode Vault Token V2",
            "GVT-V2",
            deployer.address
        ],
        { initializer: 'initialize' }
    );
    await vault.deployed();
    console.log("Vault deployed to:", vault.address);
    await saveDeployment("GnodeVaultV2", vault.address);

    // Setup vault roles
    const REVENUE_MANAGER_ROLE = await vault.REVENUE_MANAGER_ROLE();
    await vault.grantRole(REVENUE_MANAGER_ROLE, deployer.address);
    console.log("Vault roles configured");

    // 3. Deploy SY
    console.log("\nDeploying SY Token...");
    const GnodeSY = await ethers.getContractFactory("PendleGnodeERC4626SY");
    const sy = await GnodeSY.deploy(vault.address);
    await sy.deployed();
    console.log("SY Token deployed to:", sy.address);
    await saveDeployment("GnodeSYV2", sy.address);

    // 4. Deploy Mock Pendle Factory
    console.log("\nDeploying Mock Pendle Factory...");
    const PendleFactory = await ethers.getContractFactory("MockPendleMarketFactory");
    const factory = await PendleFactory.deploy();
    await factory.deployed();
    console.log("Mock Pendle Factory deployed to:", factory.address);
    await saveDeployment("MockPendleFactory", factory.address);

    // 5. Deploy Mock Pendle Router
    console.log("\nDeploying Mock Pendle Router...");
    const PendleRouter = await ethers.getContractFactory("MockPendleRouter");
    const router = await PendleRouter.deploy();
    await router.deployed();
    console.log("Mock Pendle Router deployed to:", router.address);
    await saveDeployment("MockPendleRouter", router.address);

    // 6. Create Market
    console.log("\nCreating Pendle Market...");
    
    // Get current block
    const currentBlock = await ethers.provider.getBlock('latest');
    const currentTimestamp = currentBlock.timestamp;
    
    // Set expiry to 1 day from current block timestamp
    const oneDayFromNow = currentTimestamp + (24 * 60 * 60);
    
    // Create market
    const tx = await factory.createNewMarket(
        sy.address,           // SY token
        oneDayFromNow,       // expiry
        ethers.utils.parseEther("0.95")  // initial anchor (95%)
    );
    const receipt = await tx.wait();
    
    // Get market address from event
    const marketAddress = receipt.events?.find(
        (e: any) => e.event === "CreateNewMarket"
    )?.args?.market;
    
    console.log("Pendle Market created at:", marketAddress);
    await saveDeployment("GnodeMarketV2", marketAddress);

    // 7. Approve router
    await sy.approve(router.address, ethers.constants.MaxUint256);
    console.log("Router approved for SY token");

    return {
        mockGnode: mockGnode.address,
        vault: vault.address,
        sy: sy.address,
        factory: factory.address,
        router: router.address,
        market: marketAddress
    };
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