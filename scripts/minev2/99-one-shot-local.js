// npx hardhat run scripts/minev2/99-one-shot-local.js --network localhost
// Orchestrates a local fork run: deploy stack -> deposit -> (PT/YT & market) -> mint PY -> queue request/claim -> post-exp PT exit

const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
  const env = (k, req=true) => { const v = process.env[k]; if (req && (!v || !/^0x[0-9a-fA-F]{40}$/.test(v))) throw new Error(`Missing/invalid ${k}`); return v; };

  // 1) Deploy stack
  console.log("[1] Deploying stack...");
  const NODE = env("NODE");
  const VaultF = await ethers.getContractFactory("GnodeVault");
  const vault = await VaultF.deploy(); await vault.deployed();
  await (await vault.initialize(NODE, "gnode Vault", "gnode", (await ethers.getSigners())[0].address)).wait();
  const QueueF = await ethers.getContractFactory("GnodeQueue");
  const queue = await QueueF.deploy(); await queue.deployed();
  await (await queue.initialize(vault.address, 3600, 86400, ethers.utils.parseUnits("1000000", 18), (await ethers.getSigners())[0].address)).wait();
  const QUEUE_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("QUEUE_ROLE"));
  await (await vault.grantRole(QUEUE_ROLE, queue.address)).wait();
  const SYF = await ethers.getContractFactory("PendleGnodeERC4626SY");
  const sy = await SYF.deploy(vault.address); await sy.deployed();
  console.log("VAULT=", vault.address, "QUEUE=", queue.address, "SY=", sy.address);

  // 2) Deposit NODE -> SY
  console.log("[2] Depositing NODE -> SY...");
  const [signer] = await ethers.getSigners();
  const node = new ethers.Contract(NODE, ["function mint(address,uint256)", "function approve(address,uint256)", "function decimals() view returns(uint8)", "function balanceOf(address) view returns (uint256)"], signer);
  const dec = await node.decimals().catch(()=>18);
  try { await (await node.mint(await signer.getAddress(), ethers.utils.parseUnits("10000", dec))).wait(); } catch {}
  await (await node.approve(sy.address, ethers.constants.MaxUint256)).wait();
  await (await sy.deposit(await signer.getAddress(), NODE, ethers.utils.parseUnits("1000", dec), 0)).wait();

  // 3) Try PT/YT + market (optional)
  const FACTORY_YC = process.env.PENDLE_YIELD_CONTRACT_FACTORY;
  const FACTORY_MKT = process.env.PENDLE_MARKET_FACTORY;
  let PT, YT, MARKET;
  if (FACTORY_YC && FACTORY_MKT && /^0x[0-9a-fA-F]{40}$/.test(FACTORY_YC) && /^0x[0-9a-fA-F]{40}$/.test(FACTORY_MKT)) {
    console.log("[3] Creating PT/YT + Market...");
    const WEEK = 7 * 24 * 60 * 60; const now = Math.floor(Date.now()/1000); const expiry = Math.ceil((now + 2*WEEK)/WEEK)*WEEK;
    const ycf = new ethers.Contract(FACTORY_YC, ["function createYieldContract(address,uint32,bool) returns (address,address)"], signer);
    try {
      [PT, YT] = await ycf.callStatic.createYieldContract(sy.address, expiry, false);
      await (await ycf.createYieldContract(sy.address, expiry, false)).wait();
      const mf = new ethers.Contract(FACTORY_MKT, ["function createNewMarket(address,int256,int256,uint80) returns (address)", "function minInitialAnchor() view returns (int256)", "function maxLnFeeRateRoot() view returns (uint80)"], signer);
      const minA = await mf.minInitialAnchor(); const maxF = await mf.maxLnFeeRateRoot();
      const scalar = ethers.utils.parseUnits("1", 18); const init = minA; const fee = maxF.div(2);
      MARKET = await mf.callStatic.createNewMarket(PT, scalar, init, fee);
      await (await mf.createNewMarket(PT, scalar, init, fee)).wait();
      console.log("PT=", PT, "YT=", YT, "MARKET=", MARKET);
    } catch (e) { console.log("[skip] PT/YT creation failed on fork (likely whitelist)"); }
  } else {
    console.log("[skip] No Pendle factories provided; skipping PT/YT + market.");
  }

  // 4) Queue request/claim
  console.log("[4] Queue request/claim...");
  const gnode = new ethers.Contract(vault.address, ["function balanceOf(address) view returns(uint256)", "function approve(address,uint256) returns(bool)"], signer);
  const balG = await gnode.balanceOf(await signer.getAddress());
  if (!balG.isZero()) {
    await (await gnode.approve(queue.address, balG)).wait();
    const id = await queue.callStatic.requestRedeem(balG);
    await (await queue.requestRedeem(balG)).wait();
    // time travel
    await ethers.provider.send("evm_increaseTime", [3700]);
    await ethers.provider.send("evm_mine", []);
    await (await queue.claim(id, 0)).wait();
    console.log("Claimed id=", id.toString());
  } else {
    console.log("[warn] No gnode balance to queue-redeem yet.");
  }

  // 5) Post-exp PT exit (optional)
  if (MARKET && PT) {
    console.log("[5] Post-exp PT exit...");
    // This demo does not mint PT to user; use your existing PT if any.
    console.log("Note: ensure you hold PT to test post-exp exit, then run 06 script.");
  }

  console.log("Done.");
}

main().catch((e)=>{ console.error(e); process.exit(1); });


