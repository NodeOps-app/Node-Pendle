// npx hardhat run scripts/minev2/10-deploy-voucher.js --network localhost
// Deploys GnodeSyVoucher (UUPS) and initializes with SY, vault, treasury, signer, admin.

const { ethers, upgrades } = require("hardhat");
require("dotenv").config();

function isAddr(x){ return typeof x === 'string' && /^0x[0-9a-fA-F]{40}$/.test(x); }

async function main(){
  const [deployer] = await ethers.getSigners();
  const me = await deployer.getAddress();
  console.log("Deployer:", me);

  const SY = process.env.SY_ADDRESS || "";
  const VAULT = process.env.VAULT_ERC4626 || "";
  const TREASURY = process.env.VOUCHER_TREASURY || process.env.TREASURY || ""; // optional
  const SIGNER = process.env.VOUCHER_SIGNER || ""; // trusted EIP-712 signer
  const ADMIN = process.env.VOUCHER_ADMIN || process.env.ADMIN || me;

  if (!isAddr(SY)) throw new Error("SY_ADDRESS missing/invalid");
  if (!isAddr(VAULT)) throw new Error("VAULT_ERC4626 missing/invalid");
  if (TREASURY && !isAddr(TREASURY)) throw new Error("TREASURY invalid");
  if (SIGNER && !isAddr(SIGNER)) throw new Error("VOUCHER_SIGNER invalid");
  if (!isAddr(ADMIN)) throw new Error("VOUCHER_ADMIN/ADMIN invalid");

  const F = await ethers.getContractFactory("GnodeSyVoucher");
  const voucher = await upgrades.deployProxy(F, [SY, VAULT, TREASURY, SIGNER, ADMIN], { kind: "uups", initializer: "initialize" });
  await voucher.deployed();
  console.log("GnodeSyVoucher=", voucher.address);

  console.log("\n# Export these env vars (optional):");
  console.log(`VOUCHER_ADDRESS=${voucher.address}`);
  console.log(`# SY_ADDRESS=${SY}`);
  console.log(`# VAULT_ERC4626=${VAULT}`);
  console.log(`# VOUCHER_TREASURY=${TREASURY || '<set if using pull-from-treasury>'}`);
  console.log(`# VOUCHER_SIGNER=${SIGNER || '<trusted signer addr>'}`);
  console.log(`# VOUCHER_ADMIN=${ADMIN}`);
}

main().catch((e)=>{ console.error(e); process.exit(1); });


