// npx hardhat run scripts/minev2/08-add-liquidity-single-sy.js --network localhost
// Add single-sided SY liquidity to a Pendle Market.
// ENV:
//   PENDLE_ROUTER=0x...
//   MARKET_ADDRESS=0x...
//   SY_ADDRESS=0x...
//   SY_IN=1000000000000000000000
//   MIN_LP_OUT=0
//   (optional) SIGNER_INDEX=<number>

const { ethers } = require("hardhat");
require("dotenv").config();

function isAddr(x){ return typeof x === 'string' && /^0x[0-9a-fA-F]{40}$/.test(x); }

async function pickOwnerWithSy(signers, syAddr, required) {
  const idxPref = process.env.SIGNER_INDEX !== undefined ? Number(process.env.SIGNER_INDEX) : null;
  const iface = ["function balanceOf(address) view returns (uint256)"];
  // Preferred index first
  if (idxPref !== null && signers[idxPref]) {
    const cand = signers[idxPref];
    const addr = await cand.getAddress();
    const sy = new ethers.Contract(syAddr, iface, cand);
    const bal = await sy.balanceOf(addr);
    if (bal.gte(required)) return { owner: cand, balSy: bal };
  }
  // Scan all signers for sufficient SY
  for (let i = 0; i < signers.length; i++) {
    const s = signers[i];
    const addr = await s.getAddress();
    const sy = new ethers.Contract(syAddr, iface, s);
    const bal = await sy.balanceOf(addr);
    if (bal.gte(required)) return { owner: s, balSy: bal };
  }
  throw new Error("No signer with sufficient SY balance found");
}

async function main() {
  const signers = await ethers.getSigners();

  const ROUTER = process.env.PENDLE_ROUTER;
  const MKT    = process.env.MARKET_ADDRESS;
  const SY     = process.env.SY_ADDRESS;
  const SY_IN = ethers.BigNumber.from(process.env.SY_IN || "0");
  const MIN_LP_OUT = ethers.BigNumber.from(process.env.MIN_LP_OUT || "0");

  if (!isAddr(ROUTER)) throw new Error("PENDLE_ROUTER missing/invalid");
  if (!isAddr(MKT))    throw new Error("MARKET_ADDRESS missing/invalid");
  if (!isAddr(SY))     throw new Error("SY_ADDRESS missing/invalid");
  if (SY_IN.isZero())  throw new Error("SY_IN must be > 0");

  const { owner, balSy } = await pickOwnerWithSy(signers, SY, SY_IN);
  const me = await owner.getAddress();
  console.log("Using signer:", me, "SY bal:", balSy.toString());

  const syErc20 = new ethers.Contract(SY, [
    "function balanceOf(address) view returns (uint256)",
    "function approve(address,uint256) returns (bool)",
    "function allowance(address,address) view returns (uint256)"
  ], owner);

  // Approve router
  const cur = await syErc20.allowance(me, ROUTER);
  if (cur.lt(SY_IN)) {
    const txA = await syErc20.approve(ROUTER, ethers.constants.MaxUint256);
    console.log("approve tx:", txA.hash); await txA.wait();
  }

  // Router ABI: receiver-first, single-sided SY add-liquidity
  const router = new ethers.Contract(
    ROUTER,
    [
      "function addLiquiditySingleSy(address receiver,address market,uint256 netSyIn,uint256 minLpOut) returns (uint256 netLpOut, uint256 netSyUsed)"
    ],
    owner
  );

  // Dry-run
  await router.callStatic.addLiquiditySingleSy(me, MKT, SY_IN, MIN_LP_OUT);

  // Send
  let gasLimit;
  try {
    const est = await router.estimateGas.addLiquiditySingleSy(me, MKT, SY_IN, MIN_LP_OUT);
    gasLimit = est.mul(2);
  } catch {
    gasLimit = ethers.BigNumber.from("25000000");
  }
  const tx = await router.addLiquiditySingleSy(me, MKT, SY_IN, MIN_LP_OUT, { gasLimit });
  console.log("addLiquiditySingleSy tx:", tx.hash);
  const rc = await tx.wait();
  console.log(`# add-liquidity-single mined in block ${rc.blockNumber}`);
}

main().catch((e)=>{ console.error(e); process.exit(1); });
