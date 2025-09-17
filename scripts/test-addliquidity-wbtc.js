const { ethers } = require("hardhat");

async function main() {
  console.log("🔍 Testing addLiquidity for WBTC/WETH...");
  
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
  
  // Get signer
  const [deployer] = await ethers.getSigners();
  console.log("👤 Deployer address:", deployer.address);
  
  // Get contracts
  const router = await ethers.getContractAt("QuantumSwapRouter", contracts.QuantumSwapRouter);
  
  // Token addresses from new deployment
  const WETH_ADDRESS = "0x90b97E83e22AFa2e6A96b3549A0E495D5Bae61aF";
  const WBTC_ADDRESS = "0x124dDf9BdD2DdaD012ef1D5bBd77c00F05C610DA";
  
  console.log("🔍 Token addresses:");
  console.log("WETH:", WETH_ADDRESS);
  console.log("WBTC:", WBTC_ADDRESS);
  
  // Test amounts (same as frontend)
  const amountWETH = ethers.parseEther("12"); // 12 WETH
  const amountWBTC = ethers.parseUnits("0.6", 8); // 0.6 WBTC
  
  // Slippage tolerance 0.5%
  const slippageTolerance = 0.5;
  const amountAMin = amountWETH * BigInt(Math.floor((100 - slippageTolerance) * 100)) / 10000n;
  const amountBMin = amountWBTC * BigInt(Math.floor((100 - slippageTolerance) * 100)) / 10000n;
  
  console.log("🔍 Test amounts:");
  console.log("WETH amount:", ethers.formatEther(amountWETH));
  console.log("WBTC amount:", ethers.formatUnits(amountWBTC, 8));
  console.log("WETH min:", ethers.formatEther(amountAMin));
  console.log("WBTC min:", ethers.formatUnits(amountBMin, 8));
  
  // Deadline (30 minutes from now)
  const deadline = Math.floor(Date.now() / 1000) + (30 * 60);
  
  console.log("🔍 Calling addLiquidity...");
  console.log("Parameters:");
  console.log("- tokenA (WETH):", WETH_ADDRESS);
  console.log("- tokenB (WBTC):", WBTC_ADDRESS);
  console.log("- amountADesired:", amountWETH.toString());
  console.log("- amountBDesired:", amountWBTC.toString());
  console.log("- amountAMin:", amountAMin.toString());
  console.log("- amountBMin:", amountBMin.toString());
  console.log("- to:", deployer.address);
  console.log("- deadline:", deadline);
  
  try {
    const tx = await router.addLiquidity(
      WETH_ADDRESS,
      WBTC_ADDRESS,
      amountWETH,
      amountWBTC,
      amountAMin,
      amountBMin,
      deployer.address,
      deadline
    );
    
    console.log("✅ Transaction sent:", tx.hash);
    
    const receipt = await tx.wait();
    console.log("✅ Transaction confirmed in block:", receipt.blockNumber);
    
    // Parse events
    const addLiquidityEvent = receipt.logs.find(log => {
      try {
        const parsed = router.interface.parseLog(log);
        return parsed.name === "LiquidityAdded";
      } catch {
        return false;
      }
    });
    
    if (addLiquidityEvent) {
      const parsed = router.interface.parseLog(addLiquidityEvent);
      console.log("✅ LiquidityAdded event:");
      console.log("- amountA:", ethers.formatEther(parsed.args.amountA));
      console.log("- amountB:", ethers.formatUnits(parsed.args.amountB, 8));
      console.log("- liquidity:", ethers.formatEther(parsed.args.liquidity));
    }
    
  } catch (error) {
    console.error("❌ Error:", error.message);
    
    // Try to decode the error
    if (error.data) {
      try {
        const decoded = router.interface.parseError(error.data);
        console.error("❌ Decoded error:", decoded.name, decoded.args);
      } catch (e) {
        console.error("❌ Could not decode error");
      }
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
