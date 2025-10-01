// npx hardhat run scripts/minev2/06-redeem-and-verify-post-exp.js --network localhost
// Advance to expiry and demonstrate PT -> SY -> stGnode redemption via router.

const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
  const [signer] = await ethers.getSigners();
  const ROUTER = process.env.PENDLE_ROUTER;
  const MARKET = process.env.MARKET_ADDRESS;
  const SY = process.env.SY_ADDRESS;
  const YT = process.env.YT_ADDRESS;
  const PT = process.env.PT_ADDRESS;
  if (!ROUTER || !MARKET || !SY || !YT || !PT) throw new Error("Missing env for post-exp flow");

  const market = new ethers.Contract(MARKET, ["function expiry() view returns (uint256)"], signer);
  let expiry;
  try { expiry = (await market.expiry()).toNumber(); } catch { expiry = Math.floor(Date.now()/1000)+3600; }
  const now = Math.floor(Date.now()/1000);
  const delta = Math.max(expiry - now + 5, 5);
  await ethers.provider.send("evm_increaseTime", [delta]);
  await ethers.provider.send("evm_mine", []);

  const pt = new ethers.Contract(PT, [
    "function approve(address,uint256) returns (bool)",
    "function balanceOf(address) view returns (uint256)"
  ], signer);
  const me = await signer.getAddress();
  const balPt = await pt.balanceOf(me);
  if (balPt.isZero()) return console.log("No PT to redeem");
  await (await pt.approve(ROUTER, ethers.constants.MaxUint256)).wait();

  const router = new ethers.Contract(ROUTER, [
    "function exitPostExpToSy(address,address,uint256,uint256,uint256,(address,uint256,(address,uint256,bytes)[],(address,uint256,bytes)[],bytes)) returns ((uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256))"
  ], signer);
  const emptyFills = [];
  const limit = [ethers.constants.AddressZero, ethers.constants.Zero, emptyFills, emptyFills, "0x"];
  await router.callStatic.exitPostExpToSy(me, MARKET, balPt, 0, 0, limit);
  const tx = await router.exitPostExpToSy(me, MARKET, balPt, 0, 0, limit);
  await tx.wait();
  console.log("Redeemed PT->SY; SY can now be redeemed to stGnode");
}

main().catch((e)=>{ console.error(e); process.exit(1); });


