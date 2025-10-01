// npx hardhat run scripts/minev2/02-bootstrap-and-mint.js --network localhost
// Fund users with NODE and/or gnode, deposit into SY (routes NODE into vault), and log state with clear errors.

const { ethers } = require("hardhat");
require("dotenv").config();

function isAddr(x) { return typeof x === "string" && /^0x[0-9a-fA-F]{40}$/.test(x); }

async function main() {
  const signers = await ethers.getSigners();
  const [deployer, u1, u2] = signers;
  const net = await ethers.provider.getNetwork();
  console.log("Network:", net.chainId);

  // Resolve addresses with fallbacks and logs
  const NODE = (process.env.NODE_TOKEN || process.env.UNDERLYING || process.env.NODE || "").trim();
  const VAULT = (process.env.VAULT_ERC4626 || "").trim();
  const SY    = (process.env.SY_ADDRESS || "").trim();
  console.log("Env candidates:", {
    NODE_TOKEN: process.env.NODE_TOKEN,
    UNDERLYING: process.env.UNDERLYING,
    NODE: process.env.NODE,
    SY_ADDRESS: process.env.SY_ADDRESS,
    VAULT_ERC4626: process.env.VAULT_ERC4626,
  });
  if (!isAddr(NODE)) throw new Error("[ENV] NODE missing/invalid");
  if (!isAddr(VAULT)) throw new Error("[ENV] VAULT_ERC4626 missing/invalid");
  if (!isAddr(SY)) throw new Error("[ENV] SY_ADDRESS missing/invalid");

  const me = await deployer.getAddress();
  console.log("Deployer:", me);
  console.log("Resolved:", { NODE, VAULT, SY });

  // Code checks to prevent ENS fallbacks or wrong addresses
  const codeNODE = await ethers.provider.getCode(NODE);
  const codeVAULT = await ethers.provider.getCode(VAULT);
  const codeSY = await ethers.provider.getCode(SY);
  console.log("Code present:", {
    NODE: codeNODE && codeNODE !== "0x",
    VAULT: codeVAULT && codeVAULT !== "0x",
    SY: codeSY && codeSY !== "0x",
  });
  if (codeVAULT === "0x") throw new Error("[ADDR] VAULT_ERC4626 has no code");
  if (codeSY === "0x") throw new Error("[ADDR] SY_ADDRESS has no code");

  const node = new ethers.Contract(NODE, [
    "function decimals() view returns (uint8)",
    "function balanceOf(address) view returns (uint256)",
    "function approve(address,uint256) returns (bool)",
    "function mint(address,uint256) returns (bool)"
  ], deployer);

  let dec = 18;
  try { dec = await node.decimals(); } catch { console.log("[WARN] NODE.decimals() failed; defaulting 18"); }
  console.log("NODE.decimals:", dec);

  const targetUsers = [u1, u2];
  const mintAmt = ethers.utils.parseUnits("10000", dec);

  // Attempt mint to users (best-effort)
  for (const usr of targetUsers) {
    const addr = await usr.getAddress();
    try {
      const tx = await node.mint(addr, mintAmt);
      await tx.wait();
      console.log(`[MINT] Minted ${mintAmt.toString()} to ${addr}`);
    } catch (e) {
      console.log(`[MINT] Skipped mint to ${addr}:`, e?.reason || e?.message || e);
    }
  }

  // Deposit NODE -> SY per user
  for (const usr of targetUsers) {
    const addr = await usr.getAddress();
    const nodeU = node.connect(usr);
    const syU = await ethers.getContractAt("PendleGnodeERC4626SY", SY, usr).catch(async () => {
      // fallback to fully qualified if artifact clash
      return await ethers.getContractAt("contracts/core/StandardizedYield/implementations/NodeOpsV2/PendleGnodeERC4626SY.sol:PendleGnodeERC4626SY", SY, usr);
    });

    const balBefore = await nodeU.balanceOf(addr);
    console.log(`[USER ${addr}] NODE before:`, ethers.utils.formatUnits(balBefore, dec));

    const depositAmt = balBefore.gte(mintAmt) ? mintAmt : balBefore;
    if (depositAmt.isZero()) { console.log(`[USER ${addr}] No NODE, skipping deposit`); continue; }

    try {
      const curAllow = await nodeU.balanceOf(addr); // quick read to ensure provider ok
      const al = await nodeU.approve(SY, ethers.constants.MaxUint256);
      await al.wait();
    } catch (e) {
      console.log(`[APPROVE ${addr}] Failed:`, e?.reason || e?.message || e);
      throw e;
    }

    try {
      const tx = await syU.deposit(addr, NODE, depositAmt, 0);
      console.log(`[DEPOSIT ${addr}] tx:`, tx.hash);
      await tx.wait();
      const balAfter = await nodeU.balanceOf(addr);
      console.log(`[USER ${addr}] NODE after:`, ethers.utils.formatUnits(balAfter, dec));
    } catch (e) {
      console.log(`[DEPOSIT ${addr}] Failed:`, e?.reason || e?.message || e);
      throw e;
    }
  }
}

main().catch((e)=>{ console.error(e); process.exit(1); });


