const { ethers } = require('hardhat');

async function checkPoolRatio() {
  const [deployer] = await ethers.getSigners();
  console.log('🔍 Check Pool Ratio');
  console.log('==================');
  
  // Contract addresses
  const routerAddress = '0xe8D2A1E88c91DCd5433208d4152Cc4F399a7e91d';
  const wethAddress = '0x720472c8ce72c2A2D711333e064ABD3E6BbEAdd3';
  const daiAddress = '0x5067457698Fd6Fa1C6964e416b3f42713513B3dD';
  
  try {
    const router = await ethers.getContractAt('QuantumSwapRouter', routerAddress);
    const factory = await ethers.getContractAt('QuantumSwapFactory', '0x5c74c94173F05dA1720953407cbb920F3DF9f887');
    
    // Get pair
    const pairAddress = await factory.getPair(wethAddress, daiAddress);
    const pair = await ethers.getContractAt('QuantumSwapPair', pairAddress);
    const reserves = await pair.getReserves();
    
    console.log('📊 Pool Reserves:');
    console.log('Reserve 0 (DAI):', ethers.formatEther(reserves[0]));
    console.log('Reserve 1 (WETH):', ethers.formatEther(reserves[1]));
    
    // Calculate current ratio
    const daiReserve = reserves[0];
    const wethReserve = reserves[1];
    const currentRatio = Number(daiReserve) / Number(wethReserve);
    console.log('Current Ratio (DAI/WETH):', currentRatio);
    
    // User wants to add 100 WETH and 100 DAI
    const userWethAmount = ethers.parseEther('100');
    const userDaiAmount = ethers.parseEther('100');
    const userRatio = Number(userDaiAmount) / Number(userWethAmount);
    console.log('User Ratio (DAI/WETH):', userRatio);
    
    console.log('\n🧮 Router Calculation:');
    
    // Simulate router's _addLiquidity logic
    const amountADesired = userDaiAmount; // DAI
    const amountBDesired = userWethAmount; // WETH
    const reserveA = daiReserve;
    const reserveB = wethReserve;
    
    console.log('Amount A Desired (DAI):', ethers.formatEther(amountADesired));
    console.log('Amount B Desired (WETH):', ethers.formatEther(amountBDesired));
    console.log('Reserve A (DAI):', ethers.formatEther(reserveA));
    console.log('Reserve B (WETH):', ethers.formatEther(reserveB));
    
    // Calculate optimal amounts
    const amountBOptimal = (amountADesired * reserveB) / reserveA;
    console.log('Amount B Optimal (WETH):', ethers.formatEther(amountBOptimal));
    
    if (amountBOptimal <= amountBDesired) {
      console.log('✅ Using amount A desired, amount B optimal');
      console.log('Final Amount A:', ethers.formatEther(amountADesired));
      console.log('Final Amount B:', ethers.formatEther(amountBOptimal));
    } else {
      const amountAOptimal = (amountBDesired * reserveA) / reserveB;
      console.log('✅ Using amount A optimal, amount B desired');
      console.log('Amount A Optimal (DAI):', ethers.formatEther(amountAOptimal));
      console.log('Final Amount A:', ethers.formatEther(amountAOptimal));
      console.log('Final Amount B:', ethers.formatEther(amountBDesired));
      
      // Check if amountAOptimal meets minimum
      const amountAMin = amountADesired * 995n / 1000n; // 0.5% slippage
      console.log('Amount A Min:', ethers.formatEther(amountAMin));
      console.log('Amount A Optimal >= Amount A Min:', amountAOptimal >= amountAMin);
      
      if (amountAOptimal < amountAMin) {
        console.log('❌ INSUFFICIENT_A_AMIN: Amount A Optimal is less than Amount A Min');
        console.log('   This is why the transaction fails!');
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkPoolRatio().catch(console.error);
