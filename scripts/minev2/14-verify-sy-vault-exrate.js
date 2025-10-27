// npx hardhat run scripts/minev2/14-verify-sy-vault-exrate.js --network <network>
// Diagnose SY/vault exchangeRate behavior: print A,S,E, check token addresses, previews, and (optional) test donation

const { ethers } = require("hardhat");
require("dotenv").config();

function isAddr(x){ return typeof x === 'string' && /^0x[0-9a-fA-F]{40}$/.test(x); }

async function main(){
  const [signer] = await ethers.getSigners();
  const me = await signer.getAddress();

  const NODE   = (process.env.NODE_TOKEN || process.env.UNDERLYING || process.env.NODE || "").trim();
  const VAULT  = (process.env.VAULT_ERC4626 || "").trim();
  const SY     = (process.env.SY_ADDRESS || "").trim();
  const MARKET = (process.env.MARKET_ADDRESS || "").trim();
  const DONATE = (process.env.DONATE_TEST === "1");
  const DONATE_AMT = process.env.DONATE_AMT || "0";
  if (!isAddr(NODE)) throw new Error("Missing/invalid NODE token address");
  if (!isAddr(VAULT)) throw new Error("Missing/invalid VAULT_ERC4626 address");
  if (!isAddr(SY)) throw new Error("Missing/invalid SY_ADDRESS");

  // Minimal ABIs
  const ERC20 = [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function balanceOf(address) view returns (uint256)",
    "function approve(address,uint256) returns (bool)"
  ];
  const ERC4626 = [
    "function asset() view returns (address)",
    "function totalAssets() view returns (uint256)",
    "function totalSupply() view returns (uint256)",
    "function previewDeposit(uint256) view returns (uint256)",
    "function previewMint(uint256) view returns (uint256)",
    "function previewRedeem(uint256) view returns (uint256)",
    "function previewWithdraw(uint256) view returns (uint256)",
    "function redeem(uint256,address,address) returns (uint256)",
    "function donateRevenue(uint256)"
  ];
  const SY_ABI = [
    "function exchangeRate() view returns (uint256)",
    "function previewDeposit(address,uint256) view returns (uint256)",
    "function previewRedeem(address,uint256) view returns (uint256)"
  ];
  const MARKET_ABI = [
    "function readTokens() view returns (address,address,address)",
    "function expiry() view returns (uint256)"
  ];

  const node = new ethers.Contract(NODE, ERC20, signer);
  const vault = new ethers.Contract(VAULT, ERC4626, signer);
  const sy = new ethers.Contract(SY, SY_ABI, signer);
  const market = isAddr(MARKET) ? new ethers.Contract(MARKET, MARKET_ABI, signer) : null;

  const [nName, nSym, nDec] = await Promise.all([
    node.name().catch(()=>"NODE"), node.symbol().catch(()=>"NODE"), node.decimals().catch(()=>18)
  ]);

  // Address alignment checks
  const vaultAsset = await vault.asset();
  console.log("Addresses:");
  console.log("  NODE:", NODE, `${nName} (${nSym}) dec=${nDec}`);
  console.log("  VAULT:", VAULT, "asset=", vaultAsset);
  console.log("  SY:", SY);
  if (vaultAsset.toLowerCase() !== NODE.toLowerCase()) {
    console.log("[ERROR] Vault.asset() != NODE. Donations must use vault.asset().");
  }

  // Read vault and SY state
  const [A0, S0, E_sy] = await Promise.all([
    vault.totalAssets(), vault.totalSupply(), sy.exchangeRate().catch(()=>null)
  ]);
  const E_v = S0.gt(0) ? A0.mul(ethers.constants.WeiPerEther).div(S0) : ethers.constants.Zero;
  const balNodeVault = await node.balanceOf(VAULT).catch(()=>ethers.constants.Zero);

  console.log("\nVault state:");
  console.log("  totalAssets:", A0.toString());
  console.log("  totalSupply:", S0.toString());
  console.log("  exchangeRate(vault A/S):", E_v.toString());
  if (E_sy) console.log("  SY.exchangeRate():", E_sy.toString());
  console.log("  NODE.balanceOf(vault):", balNodeVault.toString());

  // If market is provided, cross-check the market-bound SY and its rate/expiry
  if (market) {
    try {
      const [mSY, mPT, mYT] = await market.readTokens();
      const mSYc = new ethers.Contract(mSY, ["function exchangeRate() view returns(uint256)"], signer);
      const mRate = await mSYc.exchangeRate();
      const exp = await market.expiry();
      console.log("\nMarket:");
      console.log("  MARKET:", MARKET);
      console.log("  Market SY:", mSY);
      console.log("  Market PT:", mPT);
      console.log("  Market YT:", mYT);
      console.log("  Market SY.exchangeRate():", mRate.toString());
      console.log("  Market expiry:", exp.toString());
      if (mSY.toLowerCase() !== SY.toLowerCase()) {
        console.log("[WARN] Market is bound to a different SY than SY_ADDRESS env.");
      }
      const now = Math.floor(Date.now()/1000);
      if (exp.toNumber && now >= exp.toNumber()) {
        console.log("[WARN] Market appears matured (now >= expiry). Adding liquidity will fail.");
      }
      if (mRate.lt(ethers.constants.WeiPerEther)) {
        console.log("[WARN] Market SY exchange rate is < 1e18; LP adds will revert until E >= 1.");
      }
    } catch (e) {
      console.log("[Info] Could not read market tokens/rate:", e?.reason || e?.message || e);
    }
  }

  if (S0.gt(0) && E_v.lt(ethers.constants.WeiPerEther)) {
    // Donation needed to reach >= 1
    const deficit = ethers.constants.WeiPerEther.sub(E_v);
    const deltaAssets = S0.mul(deficit).div(ethers.constants.WeiPerEther);
    console.log("[Info] E < 1. Estimated donation to reach 1e18:", deltaAssets.toString(), nSym);
  }

  // SY preview sanity (small amount)
  const sample = ethers.utils.parseUnits("1", nDec);
  let syOut = ethers.constants.Zero, assetsBack = ethers.constants.Zero;
  try { syOut = await sy.previewDeposit(NODE, sample); } catch {}
  try { assetsBack = await sy.previewRedeem(VAULT, syOut); } catch {}
  if (!syOut.isZero()) {
    console.log("\nSY preview (1 NODE): sharesOut=", syOut.toString(), "; redeemBack=", assetsBack.toString());
  } else {
    console.log("\n[Info] SY.previewDeposit unavailable or zero; skip.");
  }

  // Optional mutation: test donation
  if (DONATE && DONATE_AMT !== "0") {
    const donateAmt = ethers.utils.parseUnits(DONATE_AMT, nDec);
    console.log("\n-- Test donation --");
    const A_before = await vault.totalAssets();
    const S_before = await vault.totalSupply();
    const balBefore = await node.balanceOf(VAULT);
    await (await node.approve(VAULT, donateAmt)).wait();
    const tx = await vault.donateRevenue(donateAmt);
    console.log("donateRevenue tx:", tx.hash);
    await tx.wait();
    const [A_after, S_after, balAfter] = await Promise.all([
      vault.totalAssets(), vault.totalSupply(), node.balanceOf(VAULT)
    ]);
    const E_after = S_after.gt(0) ? A_after.mul(ethers.constants.WeiPerEther).div(S_after) : ethers.constants.Zero;
    console.log("Assets delta:", A_after.sub(A_before).toString(), "(expected)", donateAmt.toString());
    console.log("Shares delta:", S_after.sub(S_before).toString(), "(expected 0)");
    console.log("Vault NODE delta:", balAfter.sub(balBefore).toString(), "(expected)", donateAmt.toString());
    console.log("New exchangeRate (A/S):", E_after.toString());
  }

  console.log("\nDone.");
}

main().catch((e)=>{ console.error(e); process.exit(1); });


