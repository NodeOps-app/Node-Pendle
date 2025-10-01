// npx hardhat run scripts/minev2/01-deploy-stack.js --network localhost
// Deploy GnodeVault (UUPS proxy, asset=NODE), GnodeQueue (UUPS proxy), and PendleGnodeERC4626SY (regular).

const { ethers, upgrades } = require("hardhat");
require("dotenv").config();

async function main() {
  const [deployer] = await ethers.getSigners();
  const me = await deployer.getAddress();

  // Prefer NODE_TOKEN or UNDERLYING to avoid collision with system env NODE
  const NODE = (process.env.NODE_TOKEN || process.env.UNDERLYING || process.env.NODE || "").trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(NODE)) throw new Error("NODE missing/invalid");

  console.log("Deployer:", me);
  console.log("NODE:", NODE);

  // Deploy GnodeVault as UUPS proxy (initializer: initialize(asset, name, symbol, admin))
  const Vault = await ethers.getContractFactory("GnodeVault");
  const vault = await upgrades.deployProxy(
    Vault,
    [NODE, "gnode Vault", "gnode", me],
    { kind: "uups", initializer: "initialize" }
  );
  await vault.deployed();
  console.log("VAULT=", vault.address);

  // Deploy GnodeQueue as UUPS proxy (initializer: initialize(vault, minDelay, epochSize, epochCap, admin))
  const Queue = await ethers.getContractFactory("GnodeQueue");
  const queue = await upgrades.deployProxy(
    Queue,
    [vault.address, 3600, 86400, ethers.utils.parseUnits("1000000", 18), me],
    { kind: "uups", initializer: "initialize" }
  );
  await queue.deployed();
  console.log("QUEUE=", queue.address);

  // Grant QUEUE_ROLE on vault to queue
  const QUEUE_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("QUEUE_ROLE"));
  await (await vault.grantRole(QUEUE_ROLE, queue.address)).wait();
  console.log("Granted QUEUE_ROLE to", queue.address);

  // Deploy SY wrapper (regular)
  const SY = await ethers.getContractFactory("PendleGnodeERC4626SY");
  const sy = await SY.deploy(vault.address);
  await sy.deployed();
  console.log("SY=", sy.address);

  console.log("\n# Export these env vars:");
  console.log(`NODE=${NODE}`);
  console.log(`VAULT_ERC4626=${vault.address}`);
  console.log(`GNODE=${vault.address}  # shares token = vault itself`);
  console.log(`GNODE_QUEUE=${queue.address}`);
  console.log(`SY_ADDRESS=${sy.address}`);
}

main().catch((e)=>{ console.error(e); process.exit(1); });


