import { ethers } from "hardhat";
import { saveDeployment } from "./utils";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);

    console.log("Deploying Mock GNODE token...");
    
    const MockGnode = await ethers.getContractFactory("MockGnodeToken");
    const mockGnode = await MockGnode.deploy();
    await mockGnode.deployed();

    console.log(`MockGnode deployed to: ${mockGnode.address}`);
    await saveDeployment("MockGnode", mockGnode.address);

    // Mint some tokens to deployer for testing
    const [deployer] = await ethers.getSigners();
    const mintAmount = ethers.utils.parseEther("1000");
    await mockGnode.mint(deployer.address, mintAmount);
    console.log(`Minted ${ethers.utils.formatEther(mintAmount)} GNODE to ${deployer.address}`);

    return {
        mockGnode: mockGnode.address
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