// npx hardhat run scripts/minev2/04-approve-and-mint-py.js --network localhost
// Approve SY and mint PY (YT) from SY. Finds a signer that actually holds SY.

const { ethers } = require("hardhat");
require("dotenv").config();

function isAddr(x){ return typeof x === 'string' && /^0x[0-9a-fA-F]{40}$/.test(x); }

async function main() {
  const signers = await ethers.getSigners();
  const ROUTER = process.env.PENDLE_ROUTER;
  const SY = process.env.SY_ADDRESS;
  const YT = process.env.YT_ADDRESS;
  if (!isAddr(ROUTER)) throw new Error("Missing/invalid PENDLE_ROUTER");
  if (!isAddr(SY)) throw new Error("Missing/invalid SY_ADDRESS");
  if (!isAddr(YT)) throw new Error("Missing/invalid YT_ADDRESS");

  // Find a signer with SY balance
  const syErc20Iface = [
    "function balanceOf(address) view returns (uint256)",
    "function approve(address,uint256) returns (bool)",
    "function allowance(address,address) view returns (uint256)"
  ];
  let owner = null, syErc20 = null, bal = null;
  for (const s of signers) {
    const addr = await s.getAddress();
    const t = new ethers.Contract(SY, syErc20Iface, s);
    const b = await t.balanceOf(addr);
    if (!b.isZero()) { owner = s; syErc20 = t; bal = b; break; }
  }
  if (!owner) throw new Error("No SY balance among available signers");
  const me = await owner.getAddress();
  console.log("Using owner:", me, "SY bal:", bal.toString());

  // Approve router if needed
  const cur = await syErc20.allowance(me, ROUTER);
  if (cur.lt(bal)) {
    const txA = await syErc20.approve(ROUTER, ethers.constants.MaxUint256);
    console.log("approve tx:", txA.hash);
    await txA.wait();
  }

  const router = new ethers.Contract(ROUTER, [
    "function mintPyFromSy(address,address,uint256,uint256) returns (uint256)"
  ], owner);

  // Dry run and send
  await router.callStatic.mintPyFromSy(me, YT, bal, 0);
  const tx = await router.mintPyFromSy(me, YT, bal, 0);
  console.log("mintPyFromSy tx:", tx.hash);
  await tx.wait();
  console.log("Minted PY from SY for:", me);
}

main().catch((e)=>{ console.error(e); process.exit(1); });


