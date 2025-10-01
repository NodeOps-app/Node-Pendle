// npx hardhat run scripts/minev2/03-create-pt-yt-and-market.js --network localhost
// Create PT/YT for the SY, then create a market.

const { ethers } = require("hardhat");
require("dotenv").config();

function computeSafeWeeklyExpiry() {
  const WEEK = 7 * 24 * 60 * 60;
  const now = Math.floor(Date.now() / 1000);
  const twoWeeks = now + 2 * WEEK;
  return Math.ceil(twoWeeks / WEEK) * WEEK;
}

async function main() {
  const [signer] = await ethers.getSigners();
  const FACTORY_YC = process.env.PENDLE_YIELD_CONTRACT_FACTORY;
  const FACTORY_MKT = process.env.PENDLE_MARKET_FACTORY;
  const SY = process.env.SY_ADDRESS;
  if (!FACTORY_YC || !FACTORY_MKT || !SY) throw new Error("Missing env: PENDLE_YIELD_CONTRACT_FACTORY, PENDLE_MARKET_FACTORY, SY_ADDRESS");

  const ycf = new ethers.Contract(FACTORY_YC, [
    "function createYieldContract(address,uint32,bool) returns (address,address)"
  ], signer);

  const expiry = computeSafeWeeklyExpiry();
  const [pt, yt] = await ycf.callStatic.createYieldContract(SY, expiry, false);
  const tx1 = await ycf.createYieldContract(SY, expiry, false);
  await tx1.wait();

  const mf = new ethers.Contract(FACTORY_MKT, [
    "function createNewMarket(address,int256,int256,uint80) returns (address)",
    "function minInitialAnchor() view returns (int256)",
    "function maxLnFeeRateRoot() view returns (uint80)"
  ], signer);
  const minInitialAnchor = await mf.minInitialAnchor();
  const maxLnFeeRateRoot = await mf.maxLnFeeRateRoot();
  const scalarRoot = ethers.utils.parseUnits("1", 18);
  const initialAnchor = minInitialAnchor;
  const lnFeeRateRoot = maxLnFeeRateRoot.div(2);
  const marketStatic = await mf.callStatic.createNewMarket(pt, scalarRoot, initialAnchor, lnFeeRateRoot);
  const tx2 = await mf.createNewMarket(pt, scalarRoot, initialAnchor, lnFeeRateRoot);
  await tx2.wait();

  console.log("PT=", pt);
  console.log("YT=", yt);
  console.log("MARKET=", marketStatic);
}

main().catch((e)=>{ console.error(e); process.exit(1); });


