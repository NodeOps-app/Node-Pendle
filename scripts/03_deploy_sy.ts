import { ethers } from "hardhat";
import { getDeploymentAddress, saveDeployment } from "./utils";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);

    const vaultAddress = await getDeploymentAddress("GnodeVault");
    console.log("Using Vault at:", vaultAddress);
    
    console.log("Deploying Gnode SY...");
    
    const GnodeSY = await ethers.getContractFactory("PendleGnodeERC4626SY");
    const sy = await GnodeSY.deploy(vaultAddress);
    await sy.deployed();

    console.log(`GnodeSY deployed to: ${sy.address}`);
    await saveDeployment("GnodeSY", sy.address);

    return {
        sy: sy.address
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