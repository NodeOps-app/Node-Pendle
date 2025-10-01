// scripts/35-mint-py-from-sy.js
// Mint PY (YT) from your SY via Pendle Router (no Hosted SDK needed).
// Make sure you have SY balance first (run 15-bootstrap-sy.js).
//
// ENV:
//   PENDLE_ROUTER=0x888888888889758F76e7103c6CbF23ABbF58F946
//   SY_ADDRESS=0x...      (your SY)
//   YT_ADDRESS=0x...      (from create-pt-yt)
//   NET_SY_IN=1000000000000000000  (1e18 SY in)
//   MIN_PY_OUT=0
//   RECEIVER=0x... (optional; defaults to signer)
const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
  const [signer] = await ethers.getSigners();
  const me = await signer.getAddress();

  const ROUTER    = process.env.PENDLE_ROUTER;
  const SY        = process.env.SY_ADDRESS;
  const YT        = process.env.YT_ADDRESS; // not used by router call; market is required
  const MARKET    = process.env.MARKET_ADDRESS; // Pendle market address (PT/YT market)
  const NET_SY_IN = process.env.NET_SY_IN || "6000000000000000000000"; // default 6000e18 (6000 SY)
  const MIN_PY_OUT = process.env.MIN_PY_OUT || "0";
  const RECEIVER = process.env.RECEIVER || me;

  if (!ROUTER || !/^0x[0-9a-fA-F]{40}$/.test(ROUTER)) throw new Error("PENDLE_ROUTER missing/invalid");
  if (!SY || !/^0x[0-9a-fA-F]{40}$/.test(SY)) throw new Error("SY_ADDRESS missing/invalid");
  if (!YT || !/^0x[0-9a-fA-F]{40}$/.test(YT)) throw new Error("YT_ADDRESS missing/invalid");
  if (!MARKET || !/^0x[0-9a-fA-F]{40}$/.test(MARKET)) throw new Error("MARKET_ADDRESS missing/invalid");

  // Basic on-chain sanity: router and market must be contracts
  const codeRouter = await ethers.provider.getCode(ROUTER);
  if (!codeRouter || codeRouter === "0x") throw new Error("PENDLE_ROUTER has no code at this fork block");
  const codeMarket = await ethers.provider.getCode(MARKET);
  if (!codeMarket || codeMarket === "0x") throw new Error("MARKET_ADDRESS has no code");

  // Amount sanity
  const netSyInBN = ethers.BigNumber.from(NET_SY_IN);
  if (netSyInBN.lte(0)) throw new Error("NET_SY_IN must be > 0");

  const erc20 = new ethers.Contract(
    SY,
    [
      "function balanceOf(address) view returns (uint256)",
      "function approve(address,uint256) returns (bool)",
      "function allowance(address,address) view returns (uint256)",
      "function decimals() view returns (uint8)"
    ],
    signer
  );

  // Verify MARKET matches SY (try multiple mainnet market ABIs)
  const marketView = new ethers.Contract(
    MARKET,
    [
      "function sy() view returns (address)",
      "function readTokens() view returns (address,address,address)"
    ],
    signer
  );
  let marketSy = ethers.constants.AddressZero;
  let marketPt = ethers.constants.AddressZero;
  let marketYt = ethers.constants.AddressZero;
  try {
    marketSy = await marketView.sy();
  } catch {}
  if (marketSy === ethers.constants.AddressZero) {
    try {
      const tokens = await marketView.readTokens();
      marketSy = tokens && tokens[0] ? tokens[0] : ethers.constants.AddressZero;
      marketPt = tokens && tokens[1] ? tokens[1] : ethers.constants.AddressZero;
      marketYt = tokens && tokens[2] ? tokens[2] : ethers.constants.AddressZero;
    } catch {}
  }
  if (marketSy !== ethers.constants.AddressZero && marketSy.toLowerCase() !== SY.toLowerCase()) {
    throw new Error(`MARKET_ADDRESS mismatch: market SY=${marketSy} but SY_ADDRESS=${SY}`);
  } else if (marketSy === ethers.constants.AddressZero) {
    console.log("Warning: could not read market SY; proceeding to callStatic check...");
  }
  if (marketYt !== ethers.constants.AddressZero && marketYt.toLowerCase() !== YT.toLowerCase()) {
    throw new Error(`YT_ADDRESS mismatch: market YT=${marketYt} but YT_ADDRESS=${YT}`);
  }

  // Optional: check expiry if exposed
  const marketTime = new ethers.Contract(
    MARKET,
    ["function expiry() view returns (uint256)"],
    signer
  );
  try {
    const expiry = await marketTime.expiry();
    const now = Math.floor(Date.now() / 1000);
    if (expiry.toNumber && expiry.toNumber() <= now) {
      throw new Error(`Market expired at ${expiry.toString()}`);
    }
  } catch {}

  // Require some SY
  const balSy = await erc20.balanceOf(me);
  if (balSy.isZero()) throw new Error("SY balance is 0. Run scripts/15-bootstrap-sy.js first.");
  if (ethers.BigNumber.from(NET_SY_IN).gt(balSy)) throw new Error(`NET_SY_IN (${NET_SY_IN}) > SY balance (${balSy.toString()}).`);

  // Approve router
  const allowance = await erc20.allowance(me, ROUTER);
  if (allowance.lt(ethers.BigNumber.from(NET_SY_IN))) {
    const txA = await erc20.approve(ROUTER, ethers.constants.MaxUint256);
    await txA.wait();
  }

  // Router ABI (ActionMiscV3): mint directly from SY using YT (no structs)
  const router = new ethers.Contract(
    ROUTER,
    [
      "function mintPyFromSy(address receiver,address YT,uint256 netSyIn,uint256 minPyOut) returns (uint256 netPyOut)"
    ],
    signer
  );

  // Ensure SY allowance to router
  const syErc20 = new ethers.Contract(SY, [
    "function allowance(address,address) view returns (uint256)",
    "function approve(address,uint256) returns (bool)"
  ], signer);
  const curAllow = await syErc20.allowance(me, ROUTER);
  if (curAllow.lt(ethers.BigNumber.from(NET_SY_IN))) {
    const txA = await syErc20.approve(ROUTER, ethers.constants.MaxUint256);
    await txA.wait();
  }

  // Try mint PT+YT from SY (requires YT, not market)
  await router.callStatic.mintPyFromSy(
    RECEIVER,
    YT,
    ethers.BigNumber.from(NET_SY_IN),
    ethers.BigNumber.from(MIN_PY_OUT)
  );

  // Send
  let gasLimit;
  let tx;
  try {
    const est = await router.estimateGas.mintPyFromSy(
      RECEIVER,
      YT,
      ethers.BigNumber.from(NET_SY_IN),
      ethers.BigNumber.from(MIN_PY_OUT)
    );
    gasLimit = est.mul(2);
  } catch {
    gasLimit = ethers.BigNumber.from("25000000");
  }
  tx = await router.mintPyFromSy(
    RECEIVER,
    YT,
    ethers.BigNumber.from(NET_SY_IN),
    ethers.BigNumber.from(MIN_PY_OUT),
    { gasLimit }
  );
  console.log("mintPyFromSy (SY->PY) tx:", tx.hash);
  const rc = await tx.wait();
  console.log(`# minted PY; mined in block ${rc.blockNumber}`);
}

main().catch((e)=>{ console.error(e); process.exit(1); });
