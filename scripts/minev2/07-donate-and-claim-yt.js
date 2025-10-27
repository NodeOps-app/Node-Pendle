// npx hardhat run scripts/minev2/07-donate-and-claim-yt.js --network localhost
// Donate NODE into the vault to increase E(t), then claim YT yield via router for a signer that holds YT.

const { ethers } = require("hardhat");
require("dotenv").config();

function isAddr(x){ return typeof x === 'string' && /^0x[0-9a-fA-F]{40}$/.test(x); }

async function pickOwnerWithYt(signers, ytAddr) {
  const erc20 = ["function balanceOf(address) view returns (uint256)"];
  for (const s of signers) {
    const addr = await s.getAddress();
    const yt = new ethers.Contract(ytAddr, erc20, s);
    const bal = await yt.balanceOf(addr);
    if (!bal.isZero()) return { owner: s, balYt: bal };
  }
  throw new Error("No YT holder among available signers");
}

async function main() {
  const signers = await ethers.getSigners();
  const me0 = await signers[0].getAddress();

  const NODE = (process.env.NODE_TOKEN || process.env.UNDERLYING || process.env.NODE || "").trim();
  const VAULT = (process.env.VAULT_ERC4626 || "").trim();
  const SY    = (process.env.SY_ADDRESS || "").trim();
  const YT    = (process.env.YT_ADDRESS || "").trim();
  const ROUTER= (process.env.PENDLE_ROUTER || "").trim();
  if (!isAddr(NODE)) throw new Error("Missing/invalid NODE");
  if (!isAddr(VAULT)) throw new Error("Missing/invalid VAULT_ERC4626");
  if (!isAddr(SY)) throw new Error("Missing/invalid SY_ADDRESS");
  if (!isAddr(YT)) throw new Error("Missing/invalid YT_ADDRESS");
  if (!isAddr(ROUTER)) throw new Error("Missing/invalid PENDLE_ROUTER");

  // Read exchange rate before
  const syRead = await ethers.getContractAt(
    "contracts/core/StandardizedYield/implementations/NodeOpsV2/PendleGnodeERC4626SY.sol:PendleGnodeERC4626SY",
    SY,
    signers[0]
  ).catch(async () => await ethers.getContractAt("PendleGnodeERC4626SY", SY, signers[0]));
  let exBefore;
  try { exBefore = await syRead.exchangeRate(); } catch { exBefore = null; }
  console.log("exchangeRate before:", exBefore ? exBefore.toString() : "?");

  // Donate NODE into vault (using deployer)
  const node = new ethers.Contract(NODE, [
    "function decimals() view returns (uint8)",
    "function approve(address,uint256) returns (bool)",
    "function balanceOf(address) view returns (uint256)"
  ], signers[0]);
  const dec = await node.decimals().catch(()=>18);
  const donateAmt = ethers.utils.parseUnits(process.env.DONATE_AMT || "500000", dec);
  const balNode = await node.balanceOf(me0);
  if (balNode.lt(donateAmt)) console.log("[WARN] Deployer NODE insufficient, donating", balNode.toString());
  await (await node.approve(VAULT, donateAmt)).wait();
  const vault = await ethers.getContractAt("GnodeVault", VAULT, signers[0]);
  const txD = await vault.donateRevenue(donateAmt);
  console.log("donateRevenue tx:", txD.hash);
  await txD.wait();

  // Read exchange rate after
  const exAfter = await syRead.exchangeRate().catch(()=>null);
  console.log("exchangeRate after:", exAfter ? exAfter.toString() : "?");

  // Pick YT holder and claim yield
  const { owner } = await pickOwnerWithYt(signers, YT);
  const me = await owner.getAddress();
  console.log("Claiming for YT holder:", me);
  const router = new ethers.Contract(ROUTER, [
    "function redeemDueInterestAndRewards(address,address[],address[],address[])"
  ], owner);
  const txC = await router.redeemDueInterestAndRewards(me, [SY], [YT], []);
  console.log("redeemDueInterestAndRewards tx:", txC.hash);
  await txC.wait();

  console.log("Done. If desired, redeem SY → gnode to observe realized yield.");
}

main().catch((e)=>{ console.error(e); process.exit(1); });
