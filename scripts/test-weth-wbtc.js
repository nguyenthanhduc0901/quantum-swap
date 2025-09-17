const { ethers } = require("hardhat");

async function main() {
  console.log("🔍 Testing WETH/WBTC pair...");
  
  // Read contract addresses
  const fs = require('fs');
  const path = require('path');
  const addressesPath = path.join(__dirname, '../../frontend/src/constants/generated/addresses.local.json');
  
  if (!fs.existsSync(addressesPath)) {
    console.error("❌ Frontend addresses file not found");
    return;
  }
  
  const addresses = JSON.parse(fs.readFileSync(addressesPath, 'utf8'));
  const contracts = addresses[31337];
  
  if (!contracts) {
    console.error("❌ No contracts found for chain 31337");
    return;
  }
  
  console.log("📋 Contract addresses:", contracts);
  
  // Get signer
  const [deployer] = await ethers.getSigners();
  console.log("👤 Deployer address:", deployer.address);
  
  // Get contracts
  const factory = await ethers.getContractAt("QuantumSwapFactory", contracts.QuantumSwapFactory);
  const router = await ethers.getContractAt("QuantumSwapRouter", contracts.QuantumSwapRouter);
  
  // Token addresses from new deployment
  const WETH_ADDRESS = "0x90b97E83e22AFa2e6A96b3549A0E495D5Bae61aF";
  const WBTC_ADDRESS = "0x124dDf9BdD2DdaD012ef1D5bBd77c00F05C610DA";
  
  console.log("🔍 Token addresses:");
  console.log("WETH:", WETH_ADDRESS);
  console.log("WBTC:", WBTC_ADDRESS);
  
  // Check if pair exists
  const pairAddress = await factory.getPair(WETH_ADDRESS, WBTC_ADDRESS);
  console.log("🔍 Pair address:", pairAddress);
  
  if (pairAddress === "0x0000000000000000000000000000000000000000") {
    console.log("❌ Pair does not exist");
    return;
  }
  
  // Get pair contract
  const pair = await ethers.getContractAt("QuantumSwapPair", pairAddress);
  
  // Get reserves
  const reserves = await pair.getReserves();
  console.log("🔍 Reserves:");
  console.log("Reserve0:", ethers.formatEther(reserves[0]));
  console.log("Reserve1:", ethers.formatUnits(reserves[1], 8)); // WBTC has 8 decimals
  
  // Get token0 and token1
  const token0 = await pair.token0();
  const token1 = await pair.token1();
  console.log("🔍 Token order:");
  console.log("Token0:", token0);
  console.log("Token1:", token1);
  
  // Determine which is which
  let wethReserve, wbtcReserve;
  if (token0.toLowerCase() === WETH_ADDRESS.toLowerCase()) {
    wethReserve = reserves[0];
    wbtcReserve = reserves[1];
    console.log("✅ WETH is token0, WBTC is token1");
  } else {
    wethReserve = reserves[1];
    wbtcReserve = reserves[0];
    console.log("✅ WBTC is token0, WETH is token1");
  }
  
  console.log("🔍 Formatted reserves:");
  console.log("WETH reserve:", ethers.formatEther(wethReserve));
  console.log("WBTC reserve:", ethers.formatUnits(wbtcReserve, 8));
  
  // Calculate ratio
  const wethFormatted = parseFloat(ethers.formatEther(wethReserve));
  const wbtcFormatted = parseFloat(ethers.formatUnits(wbtcReserve, 8));
  
  if (wethFormatted > 0) {
    const ratio = wbtcFormatted / wethFormatted;
    console.log("🔍 Pool ratio (WBTC/WETH):", ratio);
  }
  
  // Test amounts from frontend
  const amountWETH = ethers.parseEther("12"); // 12 WETH
  const amountWBTC = ethers.parseUnits("0.6", 8); // 0.6 WBTC
  
  console.log("🔍 Test amounts:");
  console.log("WETH amount:", ethers.formatEther(amountWETH));
  console.log("WBTC amount:", ethers.formatUnits(amountWBTC, 8));
  
  // Calculate optimal amounts
  if (wethReserve > 0n && wbtcReserve > 0n) {
    const optimalWBTC = (amountWETH * wbtcReserve) / wethReserve;
    console.log("🔍 Optimal WBTC for 12 WETH:", ethers.formatUnits(optimalWBTC, 8));
    
    const optimalWETH = (amountWBTC * wethReserve) / wbtcReserve;
    console.log("🔍 Optimal WETH for 0.6 WBTC:", ethers.formatEther(optimalWETH));
  }
  
  // Check balances
  const wethToken = await ethers.getContractAt("ERC20", WETH_ADDRESS);
  const wbtcToken = await ethers.getContractAt("ERC20", WBTC_ADDRESS);
  
  const wethBalance = await wethToken.balanceOf(deployer.address);
  const wbtcBalance = await wbtcToken.balanceOf(deployer.address);
  
  console.log("🔍 User balances:");
  console.log("WETH balance:", ethers.formatEther(wethBalance));
  console.log("WBTC balance:", ethers.formatUnits(wbtcBalance, 8));
  
  // Check allowances
  const wethAllowance = await wethToken.allowance(deployer.address, contracts.QuantumSwapRouter);
  const wbtcAllowance = await wbtcToken.allowance(deployer.address, contracts.QuantumSwapRouter);
  
  console.log("🔍 Allowances:");
  console.log("WETH allowance:", ethers.formatEther(wethAllowance));
  console.log("WBTC allowance:", ethers.formatUnits(wbtcAllowance, 8));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
