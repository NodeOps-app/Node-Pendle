// scripts/mine/06-bootstrap-sy.js
// Run: npx hardhat run scripts/mine/06-bootstrap-sy.js --network localhost
//
// This version ONLY talks to UNDERLYING and SY. It never calls the VAULT.

const { ethers } = require("hardhat");
require("dotenv").config();

const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function mint(address,uint256) returns (bool)",
];

const SY_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function getTokensIn() view returns (address[])",
  "function isValidTokenIn(address) view returns (bool)",
  // deposit variants we’ll probe:
  "function deposit(address tokenIn,uint256 amountIn,address receiver,uint256 minSyOut) returns (uint256)",
  "function deposit(address tokenIn,uint256 amountIn,address receiver) returns (uint256)",
];

function hr(title) {
  console.log("\n" + "-".repeat(60));
  console.log(title);
  console.log("-".repeat(60));
}

function dumpErr(prefix, e) {
  console.log(`\n[${prefix}]`);
  console.log("name     :", e?.name);
  console.log("code     :", e?.code);
  console.log("message  :", e?.message);
  if (e?.reason) console.log("reason   :", e.reason);
  if (e?.error?.message) console.log("inner    :", e.error.message);
}

async function main() {
  const signers = await ethers.getSigners();
  const users = signers.slice(0, 3);

  const UNDERLYING = process.env.UNDERLYING;
  const SY_ADDR    = process.env.SY_ADDRESS;
  const BOOT       = process.env.BOOTSTRAP_UNDERLYING || "10000";

  if (!UNDERLYING || !SY_ADDR) throw new Error("Set UNDERLYING and SY_ADDRESS in .env");

  hr("ADDRESSES");
  console.log("Signers    :", await Promise.all(users.map(s=>s.getAddress())));
  console.log("UNDERLYING :", UNDERLYING);
  console.log("SY_ADDRESS :", SY_ADDR);
  console.log("AMOUNT     :", BOOT);

  const underlying0 = new ethers.Contract(UNDERLYING, ERC20_ABI, users[0]);
  const sy0 = await ethers.getContractAt("PendleGnodeERC4626SY", SY_ADDR, users[0]);

  // Metadata
  hr("METADATA");
  const [uName, uSym, uDec] = await Promise.all([
    underlying0.name().catch(() => "?"),
    underlying0.symbol().catch(() => "?"),
    underlying0.decimals().catch(() => 18),
  ]);
  const [syName, sySym, syDec] = await Promise.all([
    sy0.name().catch(() => "?"),
    sy0.symbol().catch(() => "?"),
    sy0.decimals().catch(() => 18),
  ]);
  console.log(`UNDERLYING: ${uName} (${uSym}), dec=${uDec}`);
  console.log(`SY        : ${syName} (${sySym}), dec=${syDec}`);

  // Discover tokenIn support
  hr("SY TOKEN-IN SUPPORT");
  let tokenIns = [];
  try {
    tokenIns = await sy.getTokensIn();
    console.log("SY.getTokensIn():", tokenIns);
  } catch {
    console.log("SY.getTokensIn() not available");
  }
  let underlyingAllowed = false;
  try {
    underlyingAllowed = await sy.isValidTokenIn(UNDERLYING);
    console.log("SY.isValidTokenIn(UNDERLYING):", underlyingAllowed);
  } catch {
    console.log("SY.isValidTokenIn unavailable; will still attempt deposit()");
  }

  // For first 3 users: pre-mint UNDERLYING from minter (user[0]) best-effort
  const amt = ethers.utils.parseUnits(BOOT, uDec);
  try {
    const minter = users[0];
    const minterAddr = await minter.getAddress();
    const minterUnderlying = new ethers.Contract(UNDERLYING, ERC20_ABI, minter);
    for (const user of users) {
      const to = await user.getAddress();
      const txM = await minterUnderlying.mint(to, amt);
      await txM.wait();
      console.log(`Minted ${BOOT} UNDERLYING to ${to} (by ${minterAddr})`);
    }
  } catch {
    console.log("Global mint pass failed or not supported; will proceed per-user");
  }

  // Approve SY and deposit per user
  for (const user of users) {
    const me = await user.getAddress();
    const underlying = new ethers.Contract(UNDERLYING, ERC20_ABI, user);
    const sy = await ethers.getContractAt("PendleGnodeERC4626SY", SY_ADDR, user);

    hr(`USER ${me} FUND & DEPOSIT`);
    // Per-user mint fallback if available
    try { const t = await underlying.mint(me, amt); await t.wait(); console.log("Minted underlying (self):", BOOT); } catch { /* noop */ }

    let balU0 = await underlying.balanceOf(me);
    const balSY0 = await sy.balanceOf(me).catch(()=>ethers.constants.Zero);
    console.log("U before:", ethers.utils.formatUnits(balU0, uDec), "| SY before:", ethers.utils.formatUnits(balSY0, syDec));

    // Determine deposit amount based on actual balance
    const depositAmt = balU0.lt(amt) ? balU0 : amt;
    if (depositAmt.isZero()) { console.log("No UNDERLYING to deposit for", me, "- skipping"); continue; }

    try {
      const cur = await underlying.allowance(me, SY_ADDR);
      if (cur.lt(depositAmt)) { const txA = await underlying.approve(SY_ADDR, ethers.constants.MaxUint256); await txA.wait(); }
    } catch(e) { dumpErr("approve", e); }

    const tx = await sy.deposit(me, UNDERLYING, depositAmt, 0);
    await tx.wait();
    const balU1 = await underlying.balanceOf(me);
    const balSY1 = await sy.balanceOf(me).catch(()=>ethers.constants.Zero);
    console.log("U after :", ethers.utils.formatUnits(balU1, uDec), "| SY after :", ethers.utils.formatUnits(balSY1, syDec));
  }
}

main().catch((e) => {
  dumpErr("FATAL", e);
  process.exit(1);
});
