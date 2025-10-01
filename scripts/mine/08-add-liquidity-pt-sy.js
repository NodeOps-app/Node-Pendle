// scripts/40-add-liquidity-pt-sy.js
// OPTIONAL next step: add dual-sided liquidity (PT + SY) to your MARKET using the router.
// ENV:
//   PENDLE_ROUTER=0x8888...
//   MARKET_ADDRESS=0x...       (from create-market)
//   PT_ADDRESS=0x...           (from create-pt-yt)
//   SY_ADDRESS=0x...           (your SY)
//   PT_IN=1000000000000000000  (1e18)
//   SY_IN=1000000000000000000  (1e18)
//   MIN_LP_OUT=0
const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
  const [signer] = await ethers.getSigners();
  const me = await signer.getAddress();

  const ROUTER = process.env.PENDLE_ROUTER;
  const MKT    = process.env.MARKET_ADDRESS;
  const PT     = process.env.PT_ADDRESS;
  const SY     = process.env.SY_ADDRESS;

  const PT_IN = ethers.BigNumber.from(process.env.PT_IN || "0");
  const SY_IN = ethers.BigNumber.from(process.env.SY_IN || "0");
  const MIN_LP_OUT = ethers.BigNumber.from(process.env.MIN_LP_OUT || "0");

  if (!ROUTER || !/^0x[0-9a-fA-F]{40}$/.test(ROUTER)) throw new Error("PENDLE_ROUTER missing/invalid");
  if (!MKT    || !/^0x[0-9a-fA-F]{40}$/.test(MKT))    throw new Error("MARKET_ADDRESS missing/invalid");
  if (!PT     || !/^0x[0-9a-fA-F]{40}$/.test(PT))     throw new Error("PT_ADDRESS missing/invalid");
  if (!SY     || !/^0x[0-9a-fA-F]{40}$/.test(SY))     throw new Error("SY_ADDRESS missing/invalid");

  const erc20 = (addr)=> new ethers.Contract(addr, [
    "function balanceOf(address) view returns (uint256)",
    "function approve(address,uint256) returns (bool)",
    "function allowance(address,address) view returns (uint256)"
  ], signer);

  // ensure balances and approvals
  const ptC = erc20(PT), syC = erc20(SY);
  const balPT = await ptC.balanceOf(me);
  const balSY = await syC.balanceOf(me);
  if (balPT.lt(PT_IN)) throw new Error("Not enough PT. You can obtain PT by splitting or other router calls.");
  if (balSY.lt(SY_IN)) throw new Error("Not enough SY. Run 15-bootstrap-sy.js.");

  const needApprove = async (c, amt)=> {
    const al = await c.allowance(me, ROUTER);
    if (al.lt(amt)) { const tx = await c.approve(ROUTER, ethers.constants.MaxUint256); await tx.wait(); }
  };
  await needApprove(ptC, PT_IN);
  await needApprove(syC, SY_IN);

  // Use receiver-first signature on Router V4
  const router = new ethers.Contract(
    ROUTER,
    [
      "function addLiquidityDualSyAndPt(address receiver,address market,uint256 netSyIn,uint256 netPtIn,uint256 minLpOut) returns (uint256 netLpOut, uint256 netSyUsed, uint256 netPtUsed)"
    ],
    signer
  );

  // Dry-run
  await router.callStatic.addLiquidityDualSyAndPt(me, MKT, SY_IN, PT_IN, MIN_LP_OUT);

  // Gas and send
  let gasLimit;
  try {
    const est = await router.estimateGas.addLiquidityDualSyAndPt(me, MKT, SY_IN, PT_IN, MIN_LP_OUT);
    gasLimit = est.mul(2);
  } catch {
    gasLimit = ethers.BigNumber.from("25000000");
  }
  const tx = await router.addLiquidityDualSyAndPt(me, MKT, SY_IN, PT_IN, MIN_LP_OUT, { gasLimit });
  console.log("addLiquidity tx:", tx.hash);
  const rc = await tx.wait();
  console.log(`# add-liquidity mined in block ${rc.blockNumber}`);
}
main().catch((e)=>{ console.error(e); process.exit(1); });
