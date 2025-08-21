import { ethers, upgrades } from "hardhat";
import { getDeploymentAddress } from "./utils";

async function main() {
    const vaultAddress = await getDeploymentAddress("GnodeVault");
    
    console.log("Deploying Gnode SY...");
    
    const GnodeSY = await ethers.getContractFactory("PendleGnodeERC4626SY");
    
    const sy = await upgrades.deployProxy(
        GnodeSY,
        [vaultAddress],
        { kind: 'uups' }
    );
    await sy.deployed();

    console.log(`GnodeSY deployed to: ${sy.address}`);

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
