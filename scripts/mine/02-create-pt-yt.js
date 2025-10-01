// scripts/10-create-pt-yt.js
// npx hardhat run scripts/10-create-pt-yt.js --network localhost
const { ethers } = require("hardhat");
require("dotenv").config();

const YCF_ABI = [
  // V5: createYieldContract(address SY, uint32 expiry, bool doCacheIndexSameBlock) -> (address PT, address YT)
  "function createYieldContract(address SY, uint32 expiry, bool doCacheIndexSameBlock) returns (address PT, address YT)"
];

function computeSafeWeeklyExpiry() {
  const WEEK = 7 * 24 * 60 * 60;
  const now = Math.floor(Date.now() / 1000);
  const twoWeeksAhead = now + 2 * WEEK;
  return Math.ceil(twoWeeksAhead / WEEK) * WEEK;
}

async function main() {
  const [signer] = await ethers.getSigners();

  const FACTORY = process.env.PENDLE_YIELD_CONTRACT_FACTORY; // 0xFF29e0...
  const SY = process.env.SY_ADDRESS;                         // your SY
  // Default to a safe, weekly-aligned expiry required by mainnet factories.
  // Set USE_UNSAFE_ONE_HOUR=1 to override for local custom factories only.
  let expiry = process.env.USE_UNSAFE_ONE_HOUR === "1"
    ? Math.floor(Date.now() / 1000) + 60 * 60
    : computeSafeWeeklyExpiry();

  if (!FACTORY || !/^0x[0-9a-fA-F]{40}$/.test(FACTORY)) throw new Error("PENDLE_YIELD_CONTRACT_FACTORY missing/invalid");
  if (!SY || !/^0x[0-9a-fA-F]{40}$/.test(SY)) throw new Error("SY_ADDRESS missing/invalid");
  if (!Number.isInteger(expiry)) throw new Error("EXPIRY must be an integer (unix seconds)");
  if (expiry > 0xffffffff) throw new Error("EXPIRY exceeds uint32 max");

  const ycf = new ethers.Contract(FACTORY, YCF_ABI, signer);
  const doCache = false;

  // Preflight sanity for mainnet factories
  const WEEK = 7 * 24 * 60 * 60;
  const now = Math.floor(Date.now() / 1000);
  if (expiry % WEEK !== 0 && process.env.USE_UNSAFE_ONE_HOUR !== "1") {
    throw new Error(`EXPIRY must be week-aligned for mainnet factory. Got ${expiry}`);
  }
  if (expiry <= now) throw new Error("EXPIRY must be in the future");

  // Dry-run to surface logic errors
  let ptStatic, ytStatic;
  try {
    [ptStatic, ytStatic] = await ycf.callStatic.createYieldContract(SY, expiry, doCache);
  } catch (e) {
    console.error("callStatic.createYieldContract reverted. Common causes:");
    console.error("- SY not registered/whitelisted on the mainnet factory");
    console.error("- EXPIRY not allowed (must be week-aligned and sufficiently in the future)");
    console.error("- Permissioned factory on fork");
    throw e;
  }

  // Try to estimate gas, fall back to a big cap on fork (Ethers v5 BigNumber)
  let gasLimit = ethers.BigNumber.from(20_000_000);
  try {
    const est = await ycf.estimateGas.createYieldContract(SY, expiry, doCache);
    gasLimit = est.mul(2); // generous buffer
  } catch {}

  const tx = await ycf.createYieldContract(SY, expiry, doCache, { gasLimit });
  const rc = await tx.wait();

  console.log(`# createYieldContract mined in block ${rc.blockNumber}`);
  console.log(`PT_ADDRESS=${ptStatic}`);
  console.log(`YT_ADDRESS=${ytStatic}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
