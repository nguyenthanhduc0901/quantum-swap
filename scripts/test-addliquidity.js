const { ethers } = require('hardhat');

async function testAddLiquidity() {
  const [deployer] = await ethers.getSigners();
  console.log('🧪 Test AddLiquidity Direct Call');
  console.log('================================');
  
  // Contract addresses
  const routerAddress = '0xe8D2A1E88c91DCd5433208d4152Cc4F399a7e91d';
  const wethAddress = '0x720472c8ce72c2A2D711333e064ABD3E6BbEAdd3';
  const daiAddress = '0x5067457698Fd6Fa1C6964e416b3f42713513B3dD';
  
  try {
    const router = await ethers.getContractAt('QuantumSwapRouter', routerAddress);
    
    // Test parameters (same as frontend)
    const amountADesired = ethers.parseEther('100');
    const amountBDesired = ethers.parseEther('100');
    const amountAMin = amountADesired * 995n / 1000n; // 0.5% slippage
    const amountBMin = amountBDesired * 995n / 1000n; // 0.5% slippage
    const deadline = Math.floor(Date.now() / 1000) + 1800; // 30 minutes
    
    console.log('📋 Parameters:');
    console.log('Token A (WETH):', wethAddress);
    console.log('Token B (DAI):', daiAddress);
    console.log('Amount A Desired:', ethers.formatEther(amountADesired));
    console.log('Amount B Desired:', ethers.formatEther(amountBDesired));
    console.log('Amount A Min:', ethers.formatEther(amountAMin));
    console.log('Amount B Min:', ethers.formatEther(amountBMin));
    console.log('To:', deployer.address);
    console.log('Deadline:', deadline);
    
    console.log('\n🚀 Calling addLiquidity...');
    
    const tx = await router.addLiquidity(
      wethAddress,
      daiAddress,
      amountADesired,
      amountBDesired,
      amountAMin,
      amountBMin,
      deployer.address,
      deadline
    );
    
    console.log('✅ Transaction sent:', tx.hash);
    
    const receipt = await tx.wait();
    console.log('✅ Transaction confirmed in block:', receipt.blockNumber);
    
    // Check the result
    const logs = receipt.logs;
    console.log('📝 Events emitted:', logs.length);
    
    // Parse events
    for (const log of logs) {
      try {
        const parsed = router.interface.parseLog(log);
        console.log('Event:', parsed.name, parsed.args);
      } catch (e) {
        // Not a router event, skip
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    
    // Try to get more details
    if (error.data) {
      console.error('Error data:', error.data);
    }
    if (error.reason) {
      console.error('Error reason:', error.reason);
    }
  }
}

testAddLiquidity().catch(console.error);
