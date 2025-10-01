// scripts/mine/09-show-balances.js
// npx hardhat run scripts/mine/09-show-balances.js --network localhost

const { ethers } = require("hardhat");
require("dotenv").config();

const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
];

function fmt(amount, decimals) {
  try {
    return ethers.utils.formatUnits(amount, decimals);
  } catch {
    return amount.toString();
  }
}

async function reportToken(signer, me, label, addr) {
  if (!addr || !/^0x[0-9a-fA-F]{40}$/.test(addr)) return;
  const code = await ethers.provider.getCode(addr);
  if (!code || code === "0x") return;
  try {
    const t = new ethers.Contract(addr, ERC20_ABI, signer);
    const [name, symbol, decimals, bal] = await Promise.all([
      t.name().catch(() => label),
      t.symbol().catch(() => label),
      t.decimals().catch(() => 18),
      t.balanceOf(me).catch(() => ethers.constants.Zero),
    ]);
    console.log(`${label.padEnd(10)} ${addr} | ${name} (${symbol}) | bal=${fmt(bal, decimals)}`);
  } catch {}
}

async function main() {
  const [signer] = await ethers.getSigners();
  const me = await signer.getAddress();

  const UNDERLYING = process.env.UNDERLYING;
  const SY         = process.env.SY_ADDRESS;
  const PT         = process.env.PT_ADDRESS;
  const YT         = process.env.YT_ADDRESS;
  const MARKET     = process.env.MARKET_ADDRESS; // Pendle LP (ERC20)

  console.log("Account:", me);
  console.log("Network:", (await ethers.provider.getNetwork()).chainId);
  console.log("\nTokens (balances):");

  await reportToken(signer, me, "UNDERLYING", UNDERLYING);
  await reportToken(signer, me, "SY",         SY);
  await reportToken(signer, me, "PT",         PT);
  await reportToken(signer, me, "YT",         YT);
  await reportToken(signer, me, "MARKET",     MARKET);
}

main().catch((e) => { console.error(e); process.exit(1); });


