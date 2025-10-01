// scripts/25-approve-router.js
// npx hardhat run scripts/25-approve-router.js --network localhost
const { ethers } = require("hardhat");
require("dotenv").config();

const ERC20_ABI = [
  "function approve(address spender,uint256 amount) external returns (bool)",
  "function allowance(address owner,address spender) external view returns (uint256)",
  "function decimals() external view returns (uint8)"
];

async function approveToken(tokenAddr, routerAddr, signer) {
  if (!tokenAddr || !/^0x[0-9a-fA-F]{40}$/.test(tokenAddr)) {
    console.log("skip: token address missing/invalid");
    return;
  }
  const erc20 = new ethers.Contract(tokenAddr, ERC20_ABI, signer);

  const me = await signer.getAddress();
  const decimals = await erc20.decimals().catch(() => 18);
  const max = ethers.constants.MaxUint256;

  const tx = await erc20.approve(routerAddr, max);
  await tx.wait();

  const allowance = await erc20.allowance(me, routerAddr);
  console.log(`Approved ${tokenAddr} → ${routerAddr}`);
  console.log(`Allowance set to: ${ethers.utils.formatUnits(allowance, decimals)}`);
}

async function main() {
  const [signer] = await ethers.getSigners();

  const router = process.env.PENDLE_ROUTER;
  if (!router || !/^0x[0-9a-fA-F]{40}$/.test(router)) throw new Error("PENDLE_ROUTER missing/invalid");

  // Approve SY and PT (if you have PT)
  const sy = process.env.SY_ADDRESS;
  const pt = process.env.PT_ADDRESS;

  await approveToken(sy, router, signer);
  if (pt) await approveToken(pt, router, signer);
}

main().catch((e) => { console.error(e); process.exit(1); });
