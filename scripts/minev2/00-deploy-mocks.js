// npx hardhat run scripts/minev2/00-deploy-mocks.js --network localhost
// Deploys MockERC20Mintable for NODE (18d). Owner = deployer; script mints to deployer.

const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const Mock = await ethers.getContractFactory("MockERC20Mintable");
  const token = await Mock.deploy("Mock NODE", "mNODE", 18);
  await token.deployed();
  await (await token.mint(await deployer.getAddress(), ethers.utils.parseUnits("1000000", 18))).wait();
  console.log("NODE=", token.address);
}

main().catch((e)=>{ console.error(e); process.exit(1); });


