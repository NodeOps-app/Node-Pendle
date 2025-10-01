// npx hardhat run scripts/minev2/05-queue-request-and-claim.js --network localhost
// Redeem SY -> gnode for a chosen signer, then request in queue and claim NODE after delay.

const { ethers } = require("hardhat");
require("dotenv").config();

function isAddr(x){ return typeof x === 'string' && /^0x[0-9a-fA-F]{40}$/.test(x); }

async function pickOwnerWithSy(signers, syAddr) {
  const idxPref = process.env.SIGNER_INDEX !== undefined ? Number(process.env.SIGNER_INDEX) : null;
  const iface = ["function balanceOf(address) view returns (uint256)"];
  // Preferred index first
  if (idxPref !== null && signers[idxPref]) {
    const cand = signers[idxPref];
    const addr = await cand.getAddress();
    const sy = new ethers.Contract(syAddr, iface, cand);
    const bal = await sy.balanceOf(addr);
    if (!bal.isZero()) return { owner: cand, balSy: bal };
  }
  // Scan all signers for non-zero SY
  for (let i = 0; i < signers.length; i++) {
    const s = signers[i];
    const addr = await s.getAddress();
    const sy = new ethers.Contract(syAddr, iface, s);
    const bal = await sy.balanceOf(addr);
    if (!bal.isZero()) return { owner: s, balSy: bal };
  }
  throw new Error("No SY balance among available signers");
}

async function main() {
  const signers = await ethers.getSigners();

  const QUEUE = process.env.GNODE_QUEUE;
  const SY = process.env.SY_ADDRESS;
  const VAULT = process.env.VAULT_ERC4626;
  if (!isAddr(QUEUE)) throw new Error("Missing/invalid GNODE_QUEUE");
  if (!isAddr(SY)) throw new Error("Missing/invalid SY_ADDRESS");
  if (!isAddr(VAULT)) throw new Error("Missing/invalid VAULT_ERC4626");

  const { owner, balSy } = await pickOwnerWithSy(signers, SY);
  const me = await owner.getAddress();
  console.log("Using signer:", me, "SY bal:", balSy.toString());
  console.log("Contracts:", { QUEUE, SY, VAULT });

  // 1) Redeem SY -> gnode to hold shares locally
  const sy = await ethers.getContractAt("PendleGnodeERC4626SY", SY, owner).catch(async () => {
    return await ethers.getContractAt("contracts/core/StandardizedYield/implementations/NodeOpsV2/PendleGnodeERC4626SY.sol:PendleGnodeERC4626SY", SY, owner);
  });
  const txR = await sy.redeem(me, balSy, VAULT, 0, false);
  console.log("redeem SY->gnode tx:", txR.hash);
  await txR.wait();

  // 2) Request redeem in queue
  const queue = await ethers.getContractAt("GnodeQueue", QUEUE, owner);
  const gnode = new ethers.Contract(VAULT, [
    "function balanceOf(address) view returns (uint256)",
    "function approve(address,uint256) returns (bool)"
  ], owner);
  const balG = await gnode.balanceOf(me);
  console.log("gnode balance:", balG.toString());
  if (balG.isZero()) throw new Error("No gnode balance after redeem");
  await (await gnode.approve(QUEUE, balG)).wait();
  const id = await queue.callStatic.requestRedeem(balG);
  const txReq = await queue.requestRedeem(balG);
  console.log("requestRedeem id:", id.toString(), "tx:", txReq.hash);
  await txReq.wait();

  // 3) Time travel and claim
  const req = await queue.requests(id);
  const earliest = req.earliest.toNumber();
  const now = Math.floor(Date.now()/1000);
  const delta = Math.max(earliest - now + 1, 1);
  await ethers.provider.send("evm_increaseTime", [delta]);
  await ethers.provider.send("evm_mine", []);
  const txC = await queue.claim(id, 0);
  console.log("claim tx:", txC.hash);
  await txC.wait();
  console.log("Claimed NODE for:", me);
}

main().catch((e)=>{ console.error(e); process.exit(1); });


