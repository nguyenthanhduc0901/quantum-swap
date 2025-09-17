const { ethers } = require('hardhat');

async function debugPool() {
  const [deployer] = await ethers.getSigners();
  console.log('🔍 Debug Pool Reserves');
  console.log('=====================');
  
  // Contract addresses (updated)
  const routerAddress = '0x5302E909d1e93e30F05B5D6Eea766363D14F9892';
  const factoryAddress = '0xFD6F7A6a5c21A3f503EBaE7a473639974379c351';
  const wethAddress = '0xa6e99A4ED7498b3cdDCBB61a6A607a4925Faa1B7';
  const daiAddress = '0x0ed64d01D0B4B655E410EF1441dD677B695639E7';
  
  try {
    const factory = await ethers.getContractAt('QuantumSwapFactory', factoryAddress);
    const router = await ethers.getContractAt('QuantumSwapRouter', routerAddress);
    
    // Check if pair exists
    const pairAddress = await factory.getPair(wethAddress, daiAddress);
    console.log('Pair Address:', pairAddress);
    
    if (pairAddress === ethers.ZeroAddress) {
      console.log('❌ Pair does not exist!');
      return;
    }
    
    // Get pair contract
    const pair = await ethers.getContractAt('QuantumSwapPair', pairAddress);
    
    // Get reserves
    const reserves = await pair.getReserves();
    console.log('Reserves:', {
      reserve0: ethers.formatEther(reserves[0]),
      reserve1: ethers.formatEther(reserves[1]),
      blockTimestampLast: reserves[2]
    });
    
    // Get token addresses
    const token0 = await pair.token0();
    const token1 = await pair.token1();
    console.log('Token0:', token0);
    console.log('Token1:', token1);
    
    // Check which token is which
    const isWETH0 = token0.toLowerCase() === wethAddress.toLowerCase();
    const wethReserve = isWETH0 ? reserves[0] : reserves[1];
    const daiReserve = isWETH0 ? reserves[1] : reserves[0];
    
    console.log('WETH Reserve:', ethers.formatEther(wethReserve));
    console.log('DAI Reserve:', ethers.formatEther(daiReserve));
    
    // Calculate ratio
    const ratio = Number(wethReserve) / Number(daiReserve);
    console.log('Pool Ratio (WETH/DAI):', ratio);
    
    // Test addLiquidity with correct amounts
    const amountADesired = ethers.parseEther('100');
    const amountBDesired = ethers.parseEther('100');
    
    // Calculate optimal amounts based on pool ratio
    const amountBOptimal = (amountADesired * daiReserve) / wethReserve;
    console.log('Amount B Optimal:', ethers.formatEther(amountBOptimal));
    
    // Use smaller amounts for testing
    const testAmountA = ethers.parseEther('1');
    const testAmountB = (testAmountA * daiReserve) / wethReserve;
    
    console.log('Test Amount A:', ethers.formatEther(testAmountA));
    console.log('Test Amount B:', ethers.formatEther(testAmountB));
    
    // Calculate min amounts with 0.5% slippage
    const slippage = 0.5; // 0.5%
    const amountAMin = testAmountA * BigInt(Math.floor((100 - slippage) * 100)) / 10000n;
    const amountBMin = testAmountB * BigInt(Math.floor((100 - slippage) * 100)) / 10000n;
    
    console.log('Amount A Min:', ethers.formatEther(amountAMin));
    console.log('Amount B Min:', ethers.formatEther(amountBMin));
    
    const deadline = Math.floor(Date.now() / 1000) + 1800;
    
    console.log('\n🚀 Testing addLiquidity with correct amounts...');
    
    const tx = await router.addLiquidity(
      wethAddress,
      daiAddress,
      testAmountA,
      testAmountB,
      amountAMin,
      amountBMin,
      deployer.address,
      deadline
    );
    
    console.log('✅ Transaction sent:', tx.hash);
    
    const receipt = await tx.wait();
    console.log('✅ Transaction confirmed in block:', receipt.blockNumber);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    
    if (error.data) {
      console.error('Error data:', error.data);
    }
    if (error.reason) {
      console.error('Error reason:', error.reason);
    }
  }
}

debugPool().catch(console.error);
