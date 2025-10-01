// scripts/mine/11-inject-revenue.js
// npx hardhat run scripts/mine/11-inject-revenue.js --network localhost
// Inject GNODE revenue into the ERC4626 vault to increase exchange rate

const { ethers } = require("hardhat");
require("dotenv").config();

const ERC20 = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function mint(address,uint256) returns (bool)",
  "function decimals() view returns (uint8)"
];

async function main() {
  const [signer] = await ethers.getSigners();
  const me = await signer.getAddress();

  const GNODE = process.env.UNDERLYING;      // GNODE token
  const VAULT = process.env.VAULT_4626;      // GnodeERC4626Vault
  const AMT   = process.env.REVENUE_AMT || "5000000000000000000000"; // default 5000e18

  if (!GNODE || !/^0x[0-9a-fA-F]{40}$/.test(GNODE)) throw new Error("UNDERLYING missing/invalid");
  if (!VAULT || !/^0x[0-9a-fA-F]{40}$/.test(VAULT)) throw new Error("VAULT_4626 missing/invalid");

  const g = new ethers.Contract(GNODE, ERC20, signer);
  const decimals = await g.decimals().catch(()=>18);
  const amt = ethers.BigNumber.from(AMT);

  // Mint GNODE to funder if mock supports
  try { const t = await g.mint(me, amt); await t.wait(); } catch {}

  // Approve vault to pull revenue
  const txA = await g.approve(VAULT, amt);
  await txA.wait();

  // Call injectRevenue
  const vault = await ethers.getContractAt("GnodeERC4626Vault", VAULT, signer);
  const ex0 = await vault.convertToAssets(ethers.utils.parseUnits("1", 18)).catch(()=>null);
  const ta0 = await vault.totalAssets();

  const tx = await vault.injectRevenue(amt);
  console.log("injectRevenue tx:", tx.hash);
  const rc = await tx.wait();
  console.log(`# injected; mined in block ${rc.blockNumber}`);

  const ex1 = await vault.convertToAssets(ethers.utils.parseUnits("1", 18)).catch(()=>null);
  const ta1 = await vault.totalAssets();

  console.log("exchangeRate before:", ex0 ? ex0.toString() : "?");
  console.log("exchangeRate after :", ex1 ? ex1.toString() : "?");
  console.log("totalAssets before :", ta0.toString());
  console.log("totalAssets after  :", ta1.toString());
}

main().catch((e)=>{ console.error(e); process.exit(1); });


