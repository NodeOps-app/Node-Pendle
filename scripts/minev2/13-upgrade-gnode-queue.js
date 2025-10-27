// npx hardhat run scripts/minev2/13-upgrade-gnode-queue.js --network <network>
// Upgrade GnodeQueue (UUPS) to the latest implementation compiled in this repo

const { ethers } = require("hardhat");
require("dotenv").config();

function isAddr(x){ return typeof x === 'string' && /^0x[0-9a-fA-F]{40}$/.test(x); }

// EIP-1967 implementation slot: bytes32(uint256(keccak256('eip1967.proxy.implementation')) - 1)
const EIP1967_IMPL_SLOT = "0x360894A13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";

async function main(){
  const signers = await ethers.getSigners();
  const deployer = signers[0];
  const me = await deployer.getAddress();

  const QUEUE = (process.env.GNODE_QUEUE || process.env.GNODE_QUEUE_ADDRESS || "").trim();
  if (!isAddr(QUEUE)) throw new Error("Missing/invalid GNODE_QUEUE env address");

  console.log("Upgrading GnodeQueue at:", QUEUE);

  // Attach to proxy
  const queue = await ethers.getContractAt("GnodeQueue", QUEUE, deployer);

  // Check role
  let upgraderRole;
  try { upgraderRole = await queue.UPGRADER_ROLE(); } catch {
    // Fallback to keccak256("UPGRADER_ROLE") if constant getter is unavailable
    upgraderRole = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("UPGRADER_ROLE"));
  }
  const has = await queue.hasRole(upgraderRole, me).catch(()=>false);
  if (!has) {
    console.log("[WARN] Deployer does not have UPGRADER_ROLE; upgrade may revert.");
  }

  // Read old implementation address (best-effort)
  let oldImpl = null;
  try { oldImpl = await ethers.provider.getStorageAt(QUEUE, EIP1967_IMPL_SLOT); } catch {}
  if (oldImpl) {
    const addr = ethers.utils.getAddress("0x" + oldImpl.slice(26));
    console.log("Old implementation:", addr);
  }

  // Deploy new implementation
  const ImplFactory = await ethers.getContractFactory("GnodeQueue", deployer);
  const impl = await ImplFactory.deploy();
  await impl.deployed();
  console.log("New implementation deployed:", impl.address);

  // Perform upgrade
  const tx = await queue.upgradeTo(impl.address);
  console.log("upgradeTo tx:", tx.hash);
  await tx.wait();

  // Verify implementation slot updated
  let newImpl = null;
  try { newImpl = await ethers.provider.getStorageAt(QUEUE, EIP1967_IMPL_SLOT); } catch {}
  if (newImpl) {
    const addr = ethers.utils.getAddress("0x" + newImpl.slice(26));
    console.log("Implementation after upgrade:", addr);
  }

  // Sanity: call new view helper to ensure code updated
  try {
    const ids = await queue.getUserRequestIds(me);
    console.log("getUserRequestIds(me) ->", ids.map(x=>x.toString()));
  } catch (e) {
    console.log("[Note] getUserRequestIds not callable (ensure new impl compiled & deployed)");
  }

  console.log("Upgrade complete.");
}

main().catch((e)=>{ console.error(e); process.exit(1); });


