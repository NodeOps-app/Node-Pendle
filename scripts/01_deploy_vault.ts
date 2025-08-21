import { ethers } from "hardhat";
import { getDeploymentAddress, saveDeployment } from "./utils";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);

    const mockGnodeAddress = await getDeploymentAddress("MockGnode");
    console.log("Using MockGnode at:", mockGnodeAddress);
    
    console.log("Deploying Gnode Vault...");
    
    const GnodeVault = await ethers.getContractFactory("GnodeERC4626Vault");
    
    const vault = await upgrades.deployProxy(
        GnodeVault,
        [
            mockGnodeAddress,          // asset
            "Gnode Vault Token",       // name
            "GVT",                     // symbol
            deployer.address          // admin
        ],
        { 
            kind: 'uups',
            initializer: 'initialize' 
        }
    );

    await vault.deployed();
    console.log(`GnodeVault deployed to: ${vault.address}`);
    await saveDeployment("GnodeVault", vault.address);

    // Grant REVENUE_MANAGER_ROLE to deployer for testing
    const REVENUE_MANAGER_ROLE = await vault.REVENUE_MANAGER_ROLE();
    await vault.grantRole(REVENUE_MANAGER_ROLE, deployer.address);
    console.log(`Granted REVENUE_MANAGER_ROLE to ${deployer.address}`);

    // Approve vault to spend GNODE
    const mockGnode = await ethers.getContractAt("MockGnodeToken", mockGnodeAddress);
    await mockGnode.approve(vault.address, ethers.constants.MaxUint256);
    console.log("Approved vault to spend GNODE");

    return {
        vault: vault.address
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