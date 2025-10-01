// scripts/mine/12-simulate-trades.js
// npx hardhat run scripts/mine/12-simulate-trades.js --network localhost
// Simulate basic activity with multiple users using the working router path:
// - Both users mint PT+YT (PY) from SY via mintPyFromSy
// - Optionally transfer PT/YT between users to simulate exposure changes

const { ethers } = require("hardhat");
require("dotenv").config();

const ERC20 = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function mint(address,uint256) returns (bool)"
];

function bn(x) { return ethers.BigNumber.from(x); }
function fmt(x, d) { try { return ethers.utils.formatUnits(x, d); } catch { return x.toString(); } }

async function ensureApproval(token, owner, spender, need) {
  const cur = await token.allowance(owner, spender);
  if (cur.lt(need)) { const tx = await token.approve(spender, ethers.constants.MaxUint256); await tx.wait(); }
}

async function main() {
  const signers = await ethers.getSigners();
  const users = signers.slice(0, 3);
  const [deployer, u1, u2] = users;

  const ROUTER = process.env.PENDLE_ROUTER;
  const MARKET = process.env.MARKET_ADDRESS;
  const SY     = process.env.SY_ADDRESS;
  const UNDER  = process.env.UNDERLYING;
  const PT     = process.env.PT_ADDRESS;
  const YT     = process.env.YT_ADDRESS;
  const SY_IN_1 = process.env.TRADE_SY_IN_1 || ethers.utils.parseUnits("1000", 18).toString();
  const SY_IN_2 = process.env.TRADE_SY_IN_2 || ethers.utils.parseUnits("1000", 18).toString();
  const DO_TRANSFER_EXPOSURE = process.env.TRANSFER_EXPOSURE === "1"; // if true, swap exposures between users

  if (!ROUTER || !/^0x[0-9a-fA-F]{40}$/.test(ROUTER)) throw new Error("PENDLE_ROUTER missing/invalid");
  if (!MARKET || !/^0x[0-9a-fA-F]{40}$/.test(MARKET)) throw new Error("MARKET_ADDRESS missing/invalid");
  if (!SY || !/^0x[0-9a-fA-F]{40}$/.test(SY)) throw new Error("SY_ADDRESS missing/invalid");
  if (!UNDER  || !/^0x[0-9a-fA-F]{40}$/.test(UNDER))  throw new Error("UNDERLYING missing/invalid");
  if (!PT     || !/^0x[0-9a-fA-F]{40}$/.test(PT))     throw new Error("PT_ADDRESS missing/invalid");
  if (!YT     || !/^0x[0-9a-fA-F]{40}$/.test(YT))     throw new Error("YT_ADDRESS missing/invalid");

  const uToken = new ethers.Contract(UNDER, ERC20, deployer);
  const uDec = await uToken.decimals().catch(()=>18);

  // Router ABI: use working minimal selector
  const router = new ethers.Contract(
    ROUTER,
    [
      "function mintPyFromSy(address receiver,address YT,uint256 netSyIn,uint256 minPyOut) returns (uint256 netPyOut)"
    ],
    deployer
  );

  // User1 mints PT+YT from SY
  {
    const me = await u1.getAddress();
    const sy = new ethers.Contract(SY, ERC20, u1);
    const amountSy = bn(SY_IN_1);
    await ensureApproval(sy, me, ROUTER, amountSy);

    await router.connect(u1).callStatic.mintPyFromSy(me, YT, amountSy, bn(0));
    const est = await router.connect(u1).estimateGas.mintPyFromSy(me, YT, amountSy, bn(0)).catch(()=>bn("25000000"));
    const tx = await router.connect(u1).mintPyFromSy(me, YT, amountSy, bn(0), { gasLimit: est.mul ? est.mul(2) : est });
    console.log("user1 mintPyFromSy tx:", tx.hash);
    await tx.wait();
  }

  // User2 mints PT+YT from SY
  {
    const me = await u2.getAddress();
    const sy = new ethers.Contract(SY, ERC20, u2);
    const amountSy = bn(SY_IN_2);
    await ensureApproval(sy, me, ROUTER, amountSy);

    await router.connect(u2).callStatic.mintPyFromSy(me, YT, amountSy, bn(0));
    const est = await router.connect(u2).estimateGas.mintPyFromSy(me, YT, amountSy, bn(0)).catch(()=>bn("25000000"));
    const tx = await router.connect(u2).mintPyFromSy(me, YT, amountSy, bn(0), { gasLimit: est.mul ? est.mul(2) : est });
    console.log("user2 mintPyFromSy tx:", tx.hash);
    await tx.wait();
  }

  // Optional: simulate exposure transfer (user1 ends up PT-heavy, user2 YT-heavy)
  if (DO_TRANSFER_EXPOSURE) {
    const ptErc20 = new ethers.Contract(PT, ["function balanceOf(address) view returns (uint256)", "function transfer(address,uint256) returns (bool)"], u2);
    const ytErc20 = new ethers.Contract(YT, ["function balanceOf(address) view returns (uint256)", "function transfer(address,uint256) returns (bool)"], u1);

    const balPtU2 = await ptErc20.balanceOf(await u2.getAddress());
    const balYtU1 = await ytErc20.balanceOf(await u1.getAddress());

    if (!balPtU2.isZero()) { const tx1 = await ptErc20.transfer(await u1.getAddress(), balPtU2); await tx1.wait(); console.log("moved PT from user2 -> user1:", balPtU2.toString()); }
    if (!balYtU1.isZero()) { const tx2 = await ytErc20.transfer(await u2.getAddress(), balYtU1); await tx2.wait(); console.log("moved YT from user1 -> user2:", balYtU1.toString()); }
  }

  console.log("# Trades simulated for user[1] and user[2]");
}

main().catch((e)=>{ console.error(e); process.exit(1); });


