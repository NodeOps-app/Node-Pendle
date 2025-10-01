// scripts/mine/13-redeem-and-verify.js
// npx hardhat run scripts/mine/13-redeem-and-verify.js --network localhost
// Goal: snapshot balances, advance to expiry, redeem interest and PT->SY post-expiry, snapshot again

const { ethers } = require("hardhat");
require("dotenv").config();

const ERC20 = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)"
];

function fmt(x, d) { try { return ethers.utils.formatUnits(x, d); } catch { return x.toString(); } }
function bn(x) { return ethers.BigNumber.from(x); }

async function erc20Info(signer, addr) {
  const t = new ethers.Contract(addr, ERC20, signer);
  const [n, s, d] = await Promise.all([t.name(), t.symbol(), t.decimals()]);
  return { t, n, s, d };
}

async function snapshotBalances(signer, me, labels) {
  const out = {};
  for (const [label, { t, d }] of Object.entries(labels)) {
    out[label] = await t.balanceOf(me).catch(()=>ethers.constants.Zero);
  }
  return out;
}

async function main() {
  const signers = await ethers.getSigners();
  const users = signers.slice(0, 3);
  const [deployer, u1, u2] = users;

  const ROUTER = process.env.PENDLE_ROUTER;
  const MARKET = process.env.MARKET_ADDRESS;
  const UNDER  = process.env.UNDERLYING;
  const SY     = process.env.SY_ADDRESS;
  const PT     = process.env.PT_ADDRESS;
  const YT     = process.env.YT_ADDRESS;
  const REDEEM_SY_TO_UNDERLYING = process.env.REDEEM_SY_TO_UNDERLYING === "1";

  if (!ROUTER || !/^0x[0-9a-fA-F]{40}$/.test(ROUTER)) throw new Error("PENDLE_ROUTER missing/invalid");
  if (!MARKET || !/^0x[0-9a-fA-F]{40}$/.test(MARKET)) throw new Error("MARKET_ADDRESS missing/invalid");
  if (!UNDER  || !/^0x[0-9a-fA-F]{40}$/.test(UNDER))  throw new Error("UNDERLYING missing/invalid");
  if (!SY     || !/^0x[0-9a-fA-F]{40}$/.test(SY))     throw new Error("SY_ADDRESS missing/invalid");
  if (!PT     || !/^0x[0-9a-fA-F]{40}$/.test(PT))     throw new Error("PT_ADDRESS missing/invalid");
  if (!YT     || !/^0x[0-9a-fA-F]{40}$/.test(YT))     throw new Error("YT_ADDRESS missing/invalid");

  // Info objects
  const uInfo = await erc20Info(deployer, UNDER);
  const syInfo = await erc20Info(deployer, SY);
  const ptInfo = await erc20Info(deployer, PT);
  const ytInfo = await erc20Info(deployer, YT);

  // Market
  const market = new ethers.Contract(MARKET, [
    "function expiry() view returns (uint256)",
    "function totalSupply() view returns (uint256)"
  ], deployer);

  // Snapshot before
  console.log("\n== Snapshot BEFORE ==");
  const before = [];
  for (const u of users) {
    const me = await u.getAddress();
    const labels = { GNODE: uInfo, SY: syInfo, PT: ptInfo, YT: ytInfo };
    const bal = await snapshotBalances(u, me, labels);
    before.push({ me, bal });
    console.log(me, `| GNODE=${fmt(bal.GNODE, uInfo.d)} SY=${fmt(bal.SY, syInfo.d)} PT=${fmt(bal.PT, ptInfo.d)} YT=${fmt(bal.YT, ytInfo.d)}`);
  }

  // Advance time to just after expiry
  const now = Math.floor(Date.now() / 1000);
  let expiry;
  try { expiry = (await market.expiry()).toNumber(); } catch { expiry = now + 3605; }
  const delta = Math.max(expiry - now + 5, 5);
  await ethers.provider.send("evm_increaseTime", [delta]);
  await ethers.provider.send("evm_mine", []);
  console.log(`\nAdvanced time by ${delta}s to pass expiry=${expiry}`);

  // Router interface (post-exp): exitPostExpToSy and redeemDueInterestAndRewards
  const router = new ethers.Contract(
    ROUTER,
    [
      "function exitPostExpToSy(address receiver,address market,uint256 netPtIn,uint256 netLpIn,uint256 minSyOut,(address,uint256,(address,uint256,bytes)[],(address,uint256,bytes)[],bytes)) returns ((uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256))",
      "function redeemDueInterestAndRewards(address user,address[] sys,address[] yts,address[] markets)"
    ],
    deployer
  );
  // Fallback router interface (pre-exp combine): redeemPyToSy(receiver, YT, netPtIn, netYtIn, minSyOut)
  const routerCombine = new ethers.Contract(
    ROUTER,
    [
      "function redeemPyToSy(address receiver,address YT,uint256 netPtIn,uint256 netYtIn,uint256 minSyOut) returns (uint256 netSyOut)"
    ],
    deployer
  );

  const emptyFills = [];
  const limit = [ethers.constants.AddressZero, ethers.constants.Zero, emptyFills, emptyFills, "0x"];

  // For each user: redeem YT income (best-effort), then redeem PT -> SY post-exp
  for (const u of users) {
    const me = await u.getAddress();

    // Redeem YT income (if any)
    try {
      const txY = await router.connect(u).redeemDueInterestAndRewards(me, [SY], [YT], []);
      await txY.wait();
      console.log("redeemDueInterestAndRewards:", me);
    } catch {}

    // Approve PT/YT to router as needed
    const pt = ptInfo.t.connect(u);
    const yt = ytInfo.t.connect(u);
    const balPT = await pt.balanceOf(me);
    const balYT = await yt.balanceOf(me);
    if (balPT.gt(0)) {
      // Try post-exp specific path first
      try {
        const alPt = await pt.allowance(me, ROUTER);
        if (alPt.lt(balPT)) { const txA = await pt.approve(ROUTER, ethers.constants.MaxUint256); await txA.wait(); }
        await router.connect(u).callStatic.exitPostExpToSy(me, MARKET, balPT, bn(0), bn(0), limit);
        const est = await router.connect(u).estimateGas.exitPostExpToSy(me, MARKET, balPT, bn(0), bn(0), limit).catch(()=>bn("25000000"));
        const tx = await router.connect(u).exitPostExpToSy(me, MARKET, balPT, bn(0), bn(0), limit, { gasLimit: est.mul ? est.mul(2) : est });
        console.log("exitPostExpToSy tx:", tx.hash);
        await tx.wait();
      } catch (e) {
        // Fallback: try combine PT+YT -> SY (works pre-exp; may also work post-exp depending on router)
        try {
          const netYtIn = balYT.lt(balPT) ? balYT : balPT;
          if (netYtIn.gt(0)) {
            const alPt2 = await pt.allowance(me, ROUTER);
            if (alPt2.lt(netYtIn)) { const txAp = await pt.approve(ROUTER, ethers.constants.MaxUint256); await txAp.wait(); }
            const alYt = await yt.allowance(me, ROUTER);
            if (alYt.lt(netYtIn)) { const txAy = await yt.approve(ROUTER, ethers.constants.MaxUint256); await txAy.wait(); }
            await routerCombine.connect(u).callStatic.redeemPyToSy(me, YT, netYtIn, netYtIn, 0);
            const est2 = await routerCombine.connect(u).estimateGas.redeemPyToSy(me, YT, netYtIn, netYtIn, 0).catch(()=>bn("25000000"));
            const tx2 = await routerCombine.connect(u).redeemPyToSy(me, YT, netYtIn, netYtIn, 0, { gasLimit: est2.mul ? est2.mul(2) : est2 });
            console.log("redeemPyToSy tx:", tx2.hash);
            await tx2.wait();
          } else {
            console.log("Router lacks exitPostExpToSy and no YT to combine; skipping PT redemption for", me);
          }
        } catch {
          console.log("Router lacks exitPostExpToSy/redeemPyToSy; skipping PT redemption for", me);
        }
      }
    }

    // Optionally redeem SY -> GNODE to observe principal in underlying
    if (REDEEM_SY_TO_UNDERLYING) {
      try {
        const syBal = await syInfo.t.connect(u).balanceOf(me);
        if (syBal.gt(0)) {
          const sy = new ethers.Contract(SY, [
            "function redeem(address receiver,uint256 amountSharesToRedeem,address tokenOut,uint256 minTokenOut,bool burnFromInternalBalance) returns (uint256)"
          ], u);
          const txR = await sy.redeem(me, syBal, UNDER, 0, false);
          await txR.wait();
          console.log("redeemed SY->GNODE:", me, "amountSY:", syBal.toString());
        }
      } catch {}
    }
  }

  // Snapshot after
  console.log("\n== Snapshot AFTER ==");
  for (const u of users) {
    const me = await u.getAddress();
    const labels = { GNODE: uInfo, SY: syInfo, PT: ptInfo, YT: ytInfo };
    const bal = await snapshotBalances(u, me, labels);
    console.log(me, `| GNODE=${fmt(bal.GNODE, uInfo.d)} SY=${fmt(bal.SY, syInfo.d)} PT=${fmt(bal.PT, ptInfo.d)} YT=${fmt(bal.YT, ytInfo.d)}`);
  }
}

main().catch((e)=>{ console.error(e); process.exit(1); });


