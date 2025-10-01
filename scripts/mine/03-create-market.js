// scripts/20-create-market.js
// npx hardhat run scripts/20-create-market.js --network localhost
const { ethers } = require("hardhat");
require("dotenv").config();

/**
 * MarketFactory V5
 * createNewMarket(address PT, int256 scalarRoot, int256 initialAnchor, uint80 lnFeeRateRoot) returns (address market)
 */
const MF_ABI = [
  "function createNewMarket(address PT, int256 scalarRoot, int256 initialAnchor, uint80 lnFeeRateRoot) returns (address market)",
  "function minInitialAnchor() view returns (int256)",
  "function maxLnFeeRateRoot() view returns (uint80)",
  "function isValidMarket(address) view returns (bool)"
];

async function main() {
  const [signer] = await ethers.getSigners();

  const FACTORY = process.env.PENDLE_MARKET_FACTORY; // V5: 0xd29e76c6F15ada0150D10A1D3f45aCCD2098283B
  const PT      = process.env.PT_ADDRESS;            // from create-pt-yt output

  if (!FACTORY || !/^0x[0-9a-fA-F]{40}$/.test(FACTORY)) throw new Error("PENDLE_MARKET_FACTORY missing/invalid");
  if (!PT      || !/^0x[0-9a-fA-F]{40}$/.test(PT))      throw new Error("PT_ADDRESS missing/invalid");

  const mf = new ethers.Contract(FACTORY, MF_ABI, signer);

  // Read factory constraints (ethers v5 BigNumber)
  const minInitialAnchor = await mf.minInitialAnchor();  // BigNumber (int256)
  const maxLnFeeRateRoot = await mf.maxLnFeeRateRoot();  // BigNumber (uint80)

  // Safe params (all BigNumber for ethers v5)
  const scalarRoot    = ethers.utils.parseUnits("1", 18);      // int256 > 0
  const initialAnchor = minInitialAnchor;                       // >= minInitialAnchor
  const lnFeeRateRoot = maxLnFeeRateRoot.div(2);                // <= maxLnFeeRateRoot

  // Dry-run to surface logic reverts (invalid PT / params)
  let marketStatic;
  try {
    marketStatic = await mf.callStatic.createNewMarket(
      PT,
      scalarRoot,
      initialAnchor,
      lnFeeRateRoot
    );
  } catch (e) {
    console.error("callStatic revert while creating market. Check PT/params/factory V5.");
    throw e;
  }

  // Gas setup (estimate -> x2; fallback to big cap on fork)
  let gasLimit;
  try {
    const est = await mf.estimateGas.createNewMarket(
      PT, scalarRoot, initialAnchor, lnFeeRateRoot
    );
    gasLimit = est.mul(2);
  } catch {
    gasLimit = ethers.BigNumber.from("25000000");
  }

  const tx = await mf.createNewMarket(
    PT,
    scalarRoot,
    initialAnchor,
    lnFeeRateRoot,
    { gasLimit }
  );
  const rc = await tx.wait();

  console.log(`# createNewMarket mined in block ${rc.blockNumber}`);
  console.log(`MARKET_ADDRESS=${marketStatic}`);

  const market = new ethers.Contract(
    marketStatic,
    ["function readTokens() view returns (address SY,address PT,address YT)"],
    signer
  );
  const [syAddr, ptAddr, ytAddr] = await market.readTokens();
  console.log(`MARKET_ADDRESS=${marketStatic}`);
  console.log(`MARKET.SY=${syAddr}`);
  console.log(`MARKET.PT=${ptAddr}`);
  console.log(`MARKET.YT=${ytAddr}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
