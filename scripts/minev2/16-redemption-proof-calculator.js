// npx hardhat run scripts/minev2/16-redemption-proof-calculator.js --network localhost
// Proof calculator: deterministic per-claim payouts given initial assets/shares and a claim sequence (shares burned)
// Inputs (ENV):
//   INITIAL_ASSETS_WEI  (e.g. 2100000000000000000000 for 2,100 NODE @ 18 decimals)
//   INITIAL_SHARES_1e18 (e.g. 2000000000000000000000 for 2,000 shares scaled by 1e18)
//   SHARES_SEQ_1e18     (comma-separated shares to burn per claimant, scaled by 1e18)

const { ethers } = require("hardhat");

function bn(x){ return ethers.BigNumber.from(x.toString()); }

function fmt18(x){
  try { return ethers.utils.formatUnits(x, 18); } catch { return x.toString(); }
}

async function main(){
  const A0s = (process.env.INITIAL_ASSETS_WEI || "").trim();
  const S0s = (process.env.INITIAL_SHARES_1e18 || "").trim();
  const seqs = (process.env.SHARES_SEQ_1e18 || "").trim();
  if (!/^\d+$/.test(A0s) || !/^\d+$/.test(S0s) || !seqs) {
    throw new Error("Set INITIAL_ASSETS_WEI, INITIAL_SHARES_1e18, SHARES_SEQ_1e18");
  }
  let A = bn(A0s);
  let S = bn(S0s);
  const seq = seqs.split(',').map(s=>bn(s.trim()));

  console.log("Initial:");
  console.log("  assets (wei):", A.toString(), "=", fmt18(A));
  console.log("  shares (1e18):", S.toString(), "=", fmt18(S));

  let totalPaid = bn(0);
  seq.forEach((s, i) => {
    if (s.isZero()) return;
    if (s.gt(S)) throw new Error(`Step ${i+1}: sharesToBurn > totalShares`);
    const payout = A.mul(s).div(S); // exact integer math at 18-dec scale
    const Aafter = A.sub(payout);
    const Safter = S.sub(s);
    console.log(`\nStep ${i+1}: burn shares=${s.toString()} (${fmt18(s)})`);
    console.log("  payout (wei):", payout.toString(), "=", fmt18(payout));
    console.log("  assets ->", fmt18(A), "=>", fmt18(Aafter));
    console.log("  shares ->", fmt18(S), "=>", fmt18(Safter));
    A = Aafter; S = Safter; totalPaid = totalPaid.add(payout);
  });

  console.log("\nTotals:");
  console.log("  totalPaid (wei):", totalPaid.toString(), "=", fmt18(totalPaid));
  console.log("  final assets (wei):", A.toString(), "=", fmt18(A));
  console.log("  final shares (1e18):", S.toString(), "=", fmt18(S));
  console.log("Invariant: initialAssets == totalPaid + finalAssets ?",
    bn(A0s).eq(totalPaid.add(A)));
}

main().catch((e)=>{ console.error(e); process.exit(1); });


