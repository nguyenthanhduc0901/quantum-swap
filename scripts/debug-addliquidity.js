const { ethers } = require('hardhat');

async function debug() {
  const [deployer] = await ethers.getSigners();
  console.log('🔍 Debug AddLiquidity Issue');
  console.log('========================');
  console.log('Deployer:', deployer.address);
  
  // Contract addresses
  const routerAddress = '0xe8D2A1E88c91DCd5433208d4152Cc4F399a7e91d';
  const wethAddress = '0x720472c8ce72c2A2D711333e064ABD3E6BbEAdd3';
  const daiAddress = '0x5067457698Fd6Fa1C6964e416b3f42713513B3dD';
  
  console.log('\n📋 Contract Addresses:');
  console.log('Router:', routerAddress);
  console.log('WETH:', wethAddress);
  console.log('DAI:', daiAddress);
  
  try {
    // Get contracts
    const router = await ethers.getContractAt('QuantumSwapRouter', routerAddress);
    const weth = await ethers.getContractAt('MockERC20', wethAddress);
    const dai = await ethers.getContractAt('MockERC20', daiAddress);
    
    console.log('\n💰 Token Balances:');
    const wethBalance = await weth.balanceOf(deployer.address);
    const daiBalance = await dai.balanceOf(deployer.address);
    console.log('WETH Balance:', ethers.formatEther(wethBalance));
    console.log('DAI Balance:', ethers.formatEther(daiBalance));
    
    console.log('\n🔐 Token Allowances:');
    const wethAllowance = await weth.allowance(deployer.address, routerAddress);
    const daiAllowance = await dai.allowance(deployer.address, routerAddress);
    console.log('WETH Allowance:', ethers.formatEther(wethAllowance));
    console.log('DAI Allowance:', ethers.formatEther(daiAllowance));
    
    console.log('\n🏊 Pair Information:');
    const factory = await ethers.getContractAt('QuantumSwapFactory', '0x5c74c94173F05dA1720953407cbb920F3DF9f887');
    const pairAddress = await factory.getPair(wethAddress, daiAddress);
    console.log('Pair Address:', pairAddress);
    
    if (pairAddress !== '0x0000000000000000000000000000000000000000') {
      const pair = await ethers.getContractAt('QuantumSwapPair', pairAddress);
      const reserves = await pair.getReserves();
      const totalSupply = await pair.totalSupply();
      console.log('Reserves:', {
        reserve0: ethers.formatEther(reserves[0]),
        reserve1: ethers.formatEther(reserves[1])
      });
      console.log('Total Supply:', ethers.formatEther(totalSupply));
    }
    
    console.log('\n🧪 Test AddLiquidity Parameters:');
    const amountADesired = ethers.parseEther('100');
    const amountBDesired = ethers.parseEther('100');
    const amountAMin = amountADesired * 995n / 1000n; // 0.5% slippage
    const amountBMin = amountBDesired * 995n / 1000n; // 0.5% slippage
    const deadline = Math.floor(Date.now() / 1000) + 1800; // 30 minutes
    
    console.log('Amount A Desired:', ethers.formatEther(amountADesired));
    console.log('Amount B Desired:', ethers.formatEther(amountBDesired));
    console.log('Amount A Min:', ethers.formatEther(amountAMin));
    console.log('Amount B Min:', ethers.formatEther(amountBMin));
    console.log('Deadline:', deadline);
    
    // Check if we have enough balance and allowance
    console.log('\n✅ Validation:');
    console.log('WETH Balance >= Amount A:', wethBalance >= amountADesired);
    console.log('DAI Balance >= Amount B:', daiBalance >= amountBDesired);
    console.log('WETH Allowance >= Amount A:', wethAllowance >= amountADesired);
    console.log('DAI Allowance >= Amount B:', daiAllowance >= amountBDesired);
    
    if (wethBalance < amountADesired) {
      console.log('❌ Insufficient WETH balance');
    }
    if (daiBalance < amountBDesired) {
      console.log('❌ Insufficient DAI balance');
    }
    if (wethAllowance < amountADesired) {
      console.log('❌ Insufficient WETH allowance');
    }
    if (daiAllowance < amountBDesired) {
      console.log('❌ Insufficient DAI allowance');
    }
    
  } catch (error) {
    console.error('❌ Error during debug:', error.message);
  }
}

debug().catch(console.error);
