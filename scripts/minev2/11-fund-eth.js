// npx hardhat run scripts/minev2/11-fund-eth.js --network localhost
// Sends 10 ETH from signer[0] to a target address (hardcoded or via env FUND_TARGET)

const { ethers } = require("hardhat");

async function main() {
  const [signer] = await ethers.getSigners();
  const from = await signer.getAddress();
  const target = (process.env.FUND_TARGET || "0xE552aD32431C63563c936d582117a3fc6E256761").trim();
  const amtEth = process.env.FUND_ETH || "10";

  console.log("From:", from);
  console.log("To:", target);
  console.log("Amount ETH:", amtEth);

  const tx = await signer.sendTransaction({ to: target, value: ethers.utils.parseEther(amtEth) });
  console.log("fund tx:", tx.hash);
  await tx.wait();
  console.log("Done.");
}

main().catch((e)=>{ console.error(e); process.exit(1); });


