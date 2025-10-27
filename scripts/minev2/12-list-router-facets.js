// npx hardhat run scripts/minev2/12-list-router-facets.js --network localhost
// Enumerate Router (Diamond) facets and verify presence of key swap selectors

const { ethers } = require("hardhat");
require("dotenv").config();

function isAddr(x) { return typeof x === 'string' && /^0x[0-9a-fA-F]{40}$/.test(x); }

// IDiamondLoupe minimal ABI
const LOUPE_ABI = [
  "function facets() view returns (tuple(address facetAddress, bytes4[] functionSelectors)[])",
  "function facetAddresses() view returns (address[])",
  "function facetFunctionSelectors(address) view returns (bytes4[])",
  "function facetAddress(bytes4) view returns (address)",
];

// Common Router v4 function signatures (no returns in selector hash)
const TARGET_SIGS = [
  // PT trades
  "swapExactTokenForPt(address,address,uint256,(uint256,uint256,uint256,uint256,uint256),(address,uint256,address,address,bytes),(address,uint256,(address,uint256,bytes)[],(address,uint256,bytes)[],bytes))",
  "swapExactPtForToken(address,address,uint256,(address,uint256,address,address,bytes),(address,uint256,(address,uint256,bytes)[],(address,uint256,bytes)[],bytes))",
  "swapExactSyForPt(address,address,uint256,uint256,(uint256,uint256,uint256,uint256,uint256),(address,uint256,(address,uint256,bytes)[],(address,uint256,bytes)[],bytes))",
  "swapExactPtForSy(address,address,uint256,uint256,(address,uint256,(address,uint256,bytes)[],(address,uint256,bytes)[],bytes))",
  // YT trades
  "swapExactTokenForYt(address,address,uint256,(uint256,uint256,uint256,uint256,uint256),(address,uint256,address,address,bytes))",
  "swapExactYtForToken(address,address,uint256,(address,uint256,address,address,bytes))",
  // Mint/combine helpers often present on router
  "mintPyFromSy(address,address,uint256,uint256)",
  "redeemPyToSy(address,address,uint256,uint256,uint256)",
  // Post-expiry exit (signature may vary by router version)
  "exitPostExpToSy(address,address,uint256,uint256,uint256,(address,uint256,(address,uint256,bytes)[],(address,uint256,bytes)[],bytes))",
];

// User-provided selector hex (from explorer/dev tools)
const USER_SELECTORS = [
  { name: "swapExactPtForSy", sel: "0x3346d3a3" },
  { name: "swapExactPtForToken", sel: "0x594a88cc" },
  { name: "swapExactSyForPt", sel: "0x2a50917c" },
  { name: "swapExactTokenForPt", sel: "0xc81f847a" },
  // YT-related (from main contracts)
  { name: "swapExactSyForYt", sel: "0x7b8b4b95" },
  { name: "swapExactTokenForYt", sel: "0xed48907e" },
  { name: "swapExactYtForSy", sel: "0x80c4d566" },
  { name: "swapExactYtForToken", sel: "0x05eb5327" },
];

function toSelector(sig) {
  // ethers v5: utils.id hashes the function signature correctly
  return ethers.utils.id(sig).slice(0, 10);
}

async function main() {
  const ROUTER = (process.env.PENDLE_ROUTER || "").trim();
  if (!isAddr(ROUTER)) throw new Error("PENDLE_ROUTER missing/invalid");

  const loupe = new ethers.Contract(ROUTER, LOUPE_ABI, (await ethers.getSigners())[0]);

  console.log("Router (diamond):", ROUTER);

  // Try facets() first; fallback to facetAddresses()+facetFunctionSelectors(addr)
  let facets = [];
  let loupeOk = true;
  try {
    facets = await loupe.facets();
  } catch (e1) {
    try {
      const addrs = await loupe.facetAddresses();
      for (const a of addrs) {
        const sels = await loupe.facetFunctionSelectors(a);
        facets.push({ facetAddress: a, functionSelectors: sels });
      }
    } catch (e2) {
      loupeOk = false;
      console.log("\n[Info] Diamond Loupe interface not installed on this router (facets/facetAddresses unavailable). Skipping facet enumeration.");
    }
  }

  if (loupeOk) {
    console.log("\n== Facets & Selectors ==");
    for (const f of facets) {
      const addr = f.facetAddress || f[0];
      const selectors = (f.functionSelectors || f[1] || []).map(x => x.toString());
      console.log("\nFacet:", addr);
      if (!selectors.length) { console.log("  (no selectors)"); continue; }
      for (const sel of selectors) console.log("  ", sel);
    }
  }

  // Check specific selectors presence and owning facet
  console.log("\n== Selector Ownership (key routes) ==");
  for (const sig of TARGET_SIGS) {
    const sel = toSelector(sig);
    let owner = ethers.constants.AddressZero;
    if (loupeOk) {
      try { owner = await loupe.facetAddress(sel); } catch {}
    }
    console.log(`${sel}  <= ${sig}`);
    if (loupeOk) console.log("  facet:", owner);
  }

  // Fallback presence check (if no loupe): try static call stubs against router for known funcs
  if (!loupeOk) {
    console.log("\n== Presence check via staticCall stubs ==");
    const ROUTER_ABI_MIN = [
      // PT
      "function swapExactTokenForPt(address,address,uint256,(uint256,uint256,uint256,uint256,uint256),(address,uint256,address,address,bytes),(address,uint256,(address,uint256,bytes)[],(address,uint256,bytes)[],bytes)) returns (uint256,uint256)",
      "function swapExactPtForToken(address,address,uint256,(address,uint256,address,address,bytes),(address,uint256,(address,uint256,bytes)[],(address,uint256,bytes)[],bytes)) returns (uint256,uint256)",
      // YT
      "function swapExactTokenForYt(address,address,uint256,(uint256,uint256,uint256,uint256,uint256),(address,uint256,address,address,bytes)) returns (uint256,uint256)",
      "function swapExactYtForToken(address,address,uint256,(address,uint256,address,address,bytes)) returns (uint256,uint256)",
      // helpers
      "function mintPyFromSy(address,address,uint256,uint256) returns (uint256)",
      "function redeemPyToSy(address,address,uint256,uint256,uint256) returns (uint256)",
    ];
    const router = new ethers.Contract(ROUTER, ROUTER_ABI_MIN, (await ethers.getSigners())[0]);

    const MARKET = (process.env.MARKET_ADDRESS || ethers.constants.AddressZero).trim();
    const SY     = (process.env.SY_ADDRESS || ethers.constants.AddressZero).trim();
    const PT     = (process.env.PT_ADDRESS || ethers.constants.AddressZero).trim();
    const YT     = (process.env.YT_ADDRESS || ethers.constants.AddressZero).trim();
    const me     = await (await ethers.getSigners())[0].getAddress();
    const Zero   = ethers.constants.AddressZero;

    function logPresence(name, ok, err) {
      if (ok) console.log(`  ${name}: PRESENT`);
      else console.log(`  ${name}: missing or selector not installed (${err?.reason || err?.message || 'unknown'})`);
    }

    // Build zeroed tuples
    const approx = [ethers.constants.Zero, ethers.constants.MaxUint256.div(2), ethers.constants.Zero, 10, ethers.utils.parseUnits("0.0001", 18)];
    const tokenInputSY  = [SY, ethers.constants.Zero, SY, Zero, "0x"];
    const tokenOutputSY = [SY, ethers.constants.Zero, SY, Zero, "0x"];
    const emptyLimit    = [Zero, ethers.constants.Zero, [], [], "0x"];

    // Try each
    try { await router.callStatic.swapExactTokenForPt(me, MARKET, 0, approx, tokenInputSY, emptyLimit); logPresence("swapExactTokenForPt", true); } catch (e) { logPresence("swapExactTokenForPt", e?.reason !== 'INVALID_SELECTOR', e); }
    try { await router.callStatic.swapExactPtForToken(me, MARKET, 0, tokenOutputSY, emptyLimit); logPresence("swapExactPtForToken", true); } catch (e) { logPresence("swapExactPtForToken", e?.reason !== 'INVALID_SELECTOR', e); }
    try { await router.callStatic.swapExactTokenForYt(me, YT, 0, approx, tokenInputSY); logPresence("swapExactTokenForYt", true); } catch (e) { logPresence("swapExactTokenForYt", e?.reason !== 'INVALID_SELECTOR', e); }
    try { await router.callStatic.swapExactYtForToken(me, YT, 0, tokenOutputSY); logPresence("swapExactYtForToken", true); } catch (e) { logPresence("swapExactYtForToken", e?.reason !== 'INVALID_SELECTOR', e); }
    try { await router.callStatic.mintPyFromSy(me, YT, 0, 0); logPresence("mintPyFromSy", true); } catch (e) { logPresence("mintPyFromSy", e?.reason !== 'INVALID_SELECTOR', e); }
    try { await router.callStatic.redeemPyToSy(me, YT, 0, 0, 0); logPresence("redeemPyToSy", true); } catch (e) { logPresence("redeemPyToSy", e?.reason !== 'INVALID_SELECTOR', e); }

    // Also probe user-provided raw selectors to distinguish INVALID_SELECTOR vs other decode errors
    console.log("\n== Raw selector probe (user-provided) ==");
    const provider = ethers.provider;
    for (const u of USER_SELECTORS) {
      let ok = false; let reason = "";
      try {
        await provider.call({ to: ROUTER, data: u.sel });
        ok = true; // unlikely to succeed with no args, but mark as reachable
      } catch (e) {
        reason = e?.reason || e?.message || "unknown";
      }
      console.log(`  ${u.name} ${u.sel}: ${ok ? 'REACHABLE (no-arg call succeeded)' : 'revert'}${reason ? ' => '+reason : ''}`);
    }
  }

  console.log("\nDone.");
}

main().catch((e) => { console.error(e); process.exit(1); });


