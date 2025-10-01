// scripts/mine/10-show-market-state.js
// npx hardhat run scripts/mine/10-show-market-state.js --network localhost

const { ethers } = require("hardhat");
require("dotenv").config();

const ERC20 = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function totalSupply() view returns (uint256)"
];

function fmt(amount, decimals) {
  try { return ethers.utils.formatUnits(amount, decimals); } catch { return amount.toString(); }
}

async function getErc20Info(signer, addr, me, label) {
  const info = { label, addr, name: label, symbol: label, decimals: 18, bal: ethers.constants.Zero, total: null };
  if (!addr || !/^0x[0-9a-fA-F]{40}$/.test(addr)) return info;
  const code = await ethers.provider.getCode(addr);
  if (!code || code === "0x") return info;
  try {
    const t = new ethers.Contract(addr, ERC20, signer);
    [info.name, info.symbol, info.decimals, info.bal] = await Promise.all([
      t.name().catch(()=>label),
      t.symbol().catch(()=>label),
      t.decimals().catch(()=>18),
      t.balanceOf(me).catch(()=>ethers.constants.Zero)
    ]);
    info.total = await t.totalSupply().catch(()=>null);
  } catch {}
  return info;
}

async function main() {
  const [signer] = await ethers.getSigners();
  const me = await signer.getAddress();

  const UNDERLYING = process.env.UNDERLYING;
  const SY         = process.env.SY_ADDRESS;
  const PT         = process.env.PT_ADDRESS;
  const YT         = process.env.YT_ADDRESS;
  const MARKET     = process.env.MARKET_ADDRESS;

  console.log("Account:", me);
  const net = await ethers.provider.getNetwork();
  console.log("Network:", net.chainId);

  // SY metadata
  const sy = new ethers.Contract(SY, [
    "function exchangeRate() view returns (uint256)",
    "function getTokensIn() view returns (address[])",
    "function getTokensOut() view returns (address[])"
  ], signer);
  let exRate = null, tokensIn = [], tokensOut = [];
  try { exRate = await sy.exchangeRate(); } catch {}
  try { tokensIn = await sy.getTokensIn(); } catch {}
  try { tokensOut = await sy.getTokensOut(); } catch {}

  // Market metadata
  const market = new ethers.Contract(MARKET, [
    "function readTokens() view returns (address,address,address)",
    "function totalSupply() view returns (uint256)"
  ], signer);
  let mSY = null, mPT = null, mYT = null, lpTotal = null;
  try { [mSY, mPT, mYT] = await market.readTokens(); } catch {}
  try { lpTotal = await market.totalSupply(); } catch {}

  // Reserves (best-effort; may not exist)
  let reserves = null;
  try {
    const m2 = new ethers.Contract(MARKET, ["function getReserves() view returns (uint256,uint256)"], signer);
    reserves = await m2.getReserves();
  } catch {}

  // Balances
  const [uInfo, syInfo, ptInfo, ytInfo, lpInfo] = await Promise.all([
    getErc20Info(signer, UNDERLYING, me, "UNDERLYING"),
    getErc20Info(signer, SY,         me, "SY"),
    getErc20Info(signer, PT,         me, "PT"),
    getErc20Info(signer, YT,         me, "YT"),
    getErc20Info(signer, MARKET,     me, "MARKET")
  ]);

  console.log("\nSY Info:");
  console.log("exchangeRate:", exRate ? exRate.toString() : "?");
  console.log("tokensIn:", tokensIn);
  console.log("tokensOut:", tokensOut);

  console.log("\nMarket Info:");
  console.log("market.readTokens SY/PT/YT:", mSY, mPT, mYT);
  console.log("LP totalSupply:", lpTotal ? lpTotal.toString() : "?");
  if (reserves) console.log("reserves:", reserves[0].toString(), reserves[1].toString());

  const rows = [uInfo, syInfo, ptInfo, ytInfo, lpInfo];
  console.log("\nBalances:");
  for (const r of rows) {
    const totalTxt = r.total ? ` | total=${fmt(r.total, r.decimals)}` : "";
    console.log(`${r.label.padEnd(10)} ${r.addr || "-"} | ${r.name} (${r.symbol}) | bal=${fmt(r.bal, r.decimals)}${totalTxt}`);
  }
}

main().catch((e)=>{ console.error(e); process.exit(1); });


