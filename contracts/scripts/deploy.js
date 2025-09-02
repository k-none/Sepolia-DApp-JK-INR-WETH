const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying from:", deployer.address);

  const initialSupply = ethers.utils.parseUnits("1000000", 18);

  const JK = await ethers.getContractFactory("JKToken");
  const jk = await JK.deploy(initialSupply);
  await jk.deployed();
  console.log("JK deployed to:", jk.address);

  const INR = await ethers.getContractFactory("INRToken");
  const inr = await INR.deploy(initialSupply);
  await inr.deployed();
  console.log("INR deployed to:", inr.address);

  const WETH = await ethers.getContractFactory("WETH");
  const weth = await WETH.deploy();
  await weth.deployed();
  console.log("WETH deployed to:", weth.address);

  const AMM = await ethers.getContractFactory("SimpleAMM");
  const amm = await AMM.deploy();
  await amm.deployed();
  console.log("AMM deployed to:", amm.address);

  // Create pools
  await (await amm.createPool(jk.address, weth.address)).wait();
  console.log("Pool created: JK-WETH");
  await (await amm.createPool(inr.address, weth.address)).wait();
  console.log("Pool created: INR-WETH");

  console.log("\nDeployed addresses:");
  console.log("JK:", jk.address);
  console.log("INR:", inr.address);
  console.log("WETH:", weth.address);
  console.log("AMM:", amm.address);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
