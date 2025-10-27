// npx hardhat run scripts/minev2/09-add-liquidity-dual-auto.js --network localhost
// End-to-end dual-sided liquidity add:
// - Auto-pick signer with enough SY/PT (or mint PT from SY via router)
// - Approve tokens
// - Add liquidity (PT + SY) to Market
// ENV:
//   PENDLE_ROUTER=0x...
//   MARKET_ADDRESS=0x...
//   PT_ADDRESS=0x...
//   YT_ADDRESS=0x...
//   SY_ADDRESS=0x...
//   PT_IN=...
//   SY_IN=...
//   MIN_LP_OUT=0
//   (optional) SIGNER_INDEX=<number>

const { ethers } = require("hardhat");
require("dotenv").config();

function isAddr(x){ return typeof x === 'string' && /^0x[0-9a-fA-F]{40}$/.test(x); }

async function pickOwnerWithBalances(signers, ptAddr, syAddr, needPt, needSy) {
  const idxPref = process.env.SIGNER_INDEX !== undefined ? Number(process.env.SIGNER_INDEX) : null;
  const erc20 = ["function balanceOf(address) view returns (uint256)"];
  async function ok(s){
    const addr = await s.getAddress();
    const pt = new ethers.Contract(ptAddr, erc20, s);
    const sy = new ethers.Contract(syAddr, erc20, s);
    const [bPt, bSy] = await Promise.all([pt.balanceOf(addr), sy.balanceOf(addr)]);
    const mintPtNeeded = needPt.gt(bPt) ? needPt.sub(bPt) : ethers.constants.Zero;
    const syRequired = needSy.add(mintPtNeeded);
    return { addr, bPt, bSy, mintPtNeeded, enough: bSy.gte(syRequired) };
  }
  if (idxPref !== null && signers[idxPref]) {
    const s = signers[idxPref];
    const st = await ok(s);
    if (st.enough) return { owner: s, state: st };
  }
  for (let i = 0; i < signers.length; i++) {
    const s = signers[i];
    const st = await ok(s);
    if (st.enough) return { owner: s, state: st };
  }
  throw new Error("No signer with sufficient SY to cover SY_IN + PT minting");
}

async function ensureApproval(token, ownerAddr, spender, amount) {
  const al = await token.allowance(ownerAddr, spender);
  if (al.lt(amount)) {
    const tx = await token.approve(spender, ethers.constants.MaxUint256);
    console.log(`approve ${await token.address} -> ${spender}:`, tx.hash);
    await tx.wait();
  }
}

async function main() {
  const ROUTER = process.env.PENDLE_ROUTER;
  const MKT    = process.env.MARKET_ADDRESS;
  const PT     = process.env.PT_ADDRESS;
  const YT     = process.env.YT_ADDRESS;
  const SY     = process.env.SY_ADDRESS;
  if (![ROUTER,MKT,PT,YT,SY].every(isAddr)) throw new Error("Missing/invalid env: ROUTER/MKT/PT/YT/SY");

  const PT_IN = ethers.BigNumber.from(process.env.PT_IN || "0");
  const SY_IN = ethers.BigNumber.from(process.env.SY_IN || "0");
  const MIN_LP_OUT = ethers.BigNumber.from(process.env.MIN_LP_OUT || "0");
  if (PT_IN.isZero() || SY_IN.isZero()) throw new Error("PT_IN and SY_IN must be > 0");

  const signers = await ethers.getSigners();
  const { owner, state } = await pickOwnerWithBalances(signers, PT, SY, PT_IN, SY_IN);
  const me = await owner.getAddress();
  console.log("Using signer:", me);
  console.log("Balances:", { pt: state.bPt.toString(), sy: state.bSy.toString() });
  console.log("Need:", { PT_IN: PT_IN.toString(), SY_IN: SY_IN.toString(), mintPtNeeded: state.mintPtNeeded.toString() });

  const erc20Abi = [
    "function balanceOf(address) view returns (uint256)",
    "function approve(address,uint256) returns (bool)",
    "function allowance(address,address) view returns (uint256)"
  ];
  const ptTok = new ethers.Contract(PT, erc20Abi, owner);
  const syTok = new ethers.Contract(SY, erc20Abi, owner);

  const router = new ethers.Contract(
    ROUTER,
    [
      "function mintPyFromSy(address,address,uint256,uint256) returns (uint256)",
      "function addLiquidityDualSyAndPt(address,address,uint256,uint256,uint256) returns (uint256,uint256,uint256)"
    ],
    owner
  );

  // Approve SY for both mint and add-liquidity
  await ensureApproval(syTok, me, ROUTER, SY_IN.add(state.mintPtNeeded));

  // If we need more PT, mint from SY via router
  if (state.mintPtNeeded.gt(0)) {
    console.log(`Minting PT from SY, amount: ${state.mintPtNeeded.toString()}`);
    // Dry run
    await router.callStatic.mintPyFromSy(me, YT, state.mintPtNeeded, 0);
    const txM = await router.mintPyFromSy(me, YT, state.mintPtNeeded, 0);
    console.log("mintPyFromSy tx:", txM.hash);
    await txM.wait();
  }

  // Approve PT for add-liquidity
  await ensureApproval(ptTok, me, ROUTER, PT_IN);

  // Dry-run add liquidity
  await router.callStatic.addLiquidityDualSyAndPt(me, MKT, SY_IN, PT_IN, MIN_LP_OUT);

  // Send tx
  let gasLimit;
  try {
    const est = await router.estimateGas.addLiquidityDualSyAndPt(me, MKT, SY_IN, PT_IN, MIN_LP_OUT);
    gasLimit = est.mul(2);
  } catch {
    gasLimit = ethers.BigNumber.from("25000000");
  }
  const tx = await router.addLiquidityDualSyAndPt(me, MKT, SY_IN, PT_IN, MIN_LP_OUT, { gasLimit });
  console.log("addLiquidityDualSyAndPt tx:", tx.hash);
  const rc = await tx.wait();
  console.log(`# dual add-liquidity mined in block ${rc.blockNumber}`);
}

main().catch((e)=>{ console.error(e); process.exit(1); });
