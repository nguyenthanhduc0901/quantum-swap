const { ethers } = require('hardhat');

async function testFullFlow() {
  const [deployer] = await ethers.getSigners();
  console.log('🧪 Test Full Frontend-Backend Flow');
  console.log('==================================');
  console.log('Deployer:', deployer.address);
  
  // Get current contract addresses from generated file
  const fs = require('fs');
  const path = require('path');
  const addressesPath = path.join(__dirname, '../../frontend/src/constants/generated/addresses.local.json');
  const addresses = JSON.parse(fs.readFileSync(addressesPath, 'utf8'));
  
  const contracts = addresses['31337'];
  console.log('📋 Using addresses from frontend:');
  console.log('Factory:', contracts.QuantumSwapFactory);
  console.log('Router:', contracts.QuantumSwapRouter);
  console.log('WETH:', contracts.WETH);
  
  try {
    const factory = await ethers.getContractAt('QuantumSwapFactory', contracts.QuantumSwapFactory);
    const router = await ethers.getContractAt('QuantumSwapRouter', contracts.QuantumSwapRouter);
    const weth = await ethers.getContractAt('WETH9', contracts.WETH);
    
    // Get token addresses from generated file
    const tokens = contracts.tokens;
    const wethToken = tokens.find(t => t.symbol === 'WETH');
    const daiToken = tokens.find(t => t.symbol === 'DAI');
    
    console.log('\n🪙 Token Info:');
    console.log('WETH:', wethToken.address, 'decimals:', wethToken.decimals);
    console.log('DAI:', daiToken.address, 'decimals:', daiToken.decimals);
    
    // Check balances
    const wethContract = await ethers.getContractAt('ERC20', wethToken.address);
    const daiContract = await ethers.getContractAt('ERC20', daiToken.address);
    
    const wethBalance = await wethContract.balanceOf(deployer.address);
    const daiBalance = await daiContract.balanceOf(deployer.address);
    
    console.log('\n💰 Current Balances:');
    console.log('WETH Balance:', ethers.formatEther(wethBalance));
    console.log('DAI Balance:', ethers.formatEther(daiBalance));
    
    // Check if we have enough tokens
    if (wethBalance < ethers.parseEther('1') || daiBalance < ethers.parseEther('2000')) {
      console.log('❌ Insufficient tokens. Minting more...');
      
      // Mint more tokens
      await weth.deposit({ value: ethers.parseEther('10') });
      await daiContract.mint(deployer.address, ethers.parseEther('50000'));
      
      console.log('✅ Tokens minted');
    }
    
    // Check pair exists
    const pairAddress = await factory.getPair(wethToken.address, daiToken.address);
    console.log('\n🏊 Pair Address:', pairAddress);
    
    if (pairAddress === ethers.ZeroAddress) {
      console.log('❌ Pair does not exist!');
      return;
    }
    
    // Get pair reserves
    const pair = await ethers.getContractAt('QuantumSwapPair', pairAddress);
    const reserves = await pair.getReserves();
    
    console.log('\n📊 Pool Reserves:');
    console.log('Reserve0:', ethers.formatEther(reserves[0]));
    console.log('Reserve1:', ethers.formatEther(reserves[1]));
    
    // Determine which token is which
    const token0 = await pair.token0();
    const token1 = await pair.token1();
    
    const isWETH0 = token0.toLowerCase() === wethToken.address.toLowerCase();
    const wethReserve = isWETH0 ? reserves[0] : reserves[1];
    const daiReserve = isWETH0 ? reserves[1] : reserves[0];
    
    console.log('WETH Reserve:', ethers.formatEther(wethReserve));
    console.log('DAI Reserve:', ethers.formatEther(daiReserve));
    console.log('Pool Ratio (WETH/DAI):', Number(wethReserve) / Number(daiReserve));
    
    // Test with exact same parameters as frontend
    console.log('\n🚀 Testing with Frontend Parameters:');
    
    // Frontend parameters (from error message)
    const amountADesired = ethers.parseEther('100'); // 100 WETH
    const amountBDesired = ethers.parseEther('50');  // 50 DAI (from auto-suggest)
    
    console.log('Amount A Desired (WETH):', ethers.formatEther(amountADesired));
    console.log('Amount B Desired (DAI):', ethers.formatEther(amountBDesired));
    
    // Calculate optimal amounts based on pool ratio
    const amountBOptimal = (amountADesired * daiReserve) / wethReserve;
    console.log('Amount B Optimal:', ethers.formatEther(amountBOptimal));
    
    // Check if amounts are reasonable
    if (amountBOptimal > amountBDesired * 2n || amountBOptimal < amountBDesired / 2n) {
      console.log('⚠️  Amount B desired is very different from optimal!');
      console.log('This might cause INSUFFICIENT_A_AMIN error');
    }
    
    // Check allowances
    const wethAllowance = await wethContract.allowance(deployer.address, contracts.QuantumSwapRouter);
    const daiAllowance = await daiContract.allowance(deployer.address, contracts.QuantumSwapRouter);
    
    console.log('\n🔐 Allowances:');
    console.log('WETH Allowance:', ethers.formatEther(wethAllowance));
    console.log('DAI Allowance:', ethers.formatEther(daiAllowance));
    
    // Approve if needed
    if (wethAllowance < amountADesired) {
      console.log('Approving WETH...');
      await wethContract.approve(contracts.QuantumSwapRouter, ethers.MaxUint256);
      console.log('✅ WETH approved');
    }
    
    if (daiAllowance < amountBDesired) {
      console.log('Approving DAI...');
      await daiContract.approve(contracts.QuantumSwapRouter, ethers.MaxUint256);
      console.log('✅ DAI approved');
    }
    
    // Calculate min amounts with 0.5% slippage (same as frontend)
    const slippage = 0.5; // 0.5%
    const amountAMin = amountADesired * BigInt(Math.floor((100 - slippage) * 100)) / 10000n;
    const amountBMin = amountBDesired * BigInt(Math.floor((100 - slippage) * 100)) / 10000n;
    
    console.log('\n📉 Min Amounts (0.5% slippage):');
    console.log('Amount A Min:', ethers.formatEther(amountAMin));
    console.log('Amount B Min:', ethers.formatEther(amountBMin));
    
    const deadline = Math.floor(Date.now() / 1000) + 1800; // 30 minutes
    
    console.log('\n🎯 Final Parameters:');
    console.log('Token A (WETH):', wethToken.address);
    console.log('Token B (DAI):', daiToken.address);
    console.log('Amount A Desired:', ethers.formatEther(amountADesired));
    console.log('Amount B Desired:', ethers.formatEther(amountBDesired));
    console.log('Amount A Min:', ethers.formatEther(amountAMin));
    console.log('Amount B Min:', ethers.formatEther(amountBMin));
    console.log('To:', deployer.address);
    console.log('Deadline:', deadline);
    
    console.log('\n🚀 Calling addLiquidity...');
    
    const tx = await router.addLiquidity(
      wethToken.address,
      daiToken.address,
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
    
    // Check new reserves
    const newReserves = await pair.getReserves();
    console.log('\n📊 New Pool Reserves:');
    console.log('Reserve0:', ethers.formatEther(newReserves[0]));
    console.log('Reserve1:', ethers.formatEther(newReserves[1]));
    
    console.log('\n🎉 SUCCESS! Frontend should work now.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    
    if (error.data) {
      console.error('Error data:', error.data);
    }
    if (error.reason) {
      console.error('Error reason:', error.reason);
    }
    
    // Try to decode the error
    if (error.message.includes('INSUFFICIENT_A_AMIN')) {
      console.log('\n💡 INSUFFICIENT_A_AMIN means:');
      console.log('   - The minimum amount A is too high');
      console.log('   - Pool ratio might be very different from desired amounts');
      console.log('   - Try using smaller amounts or check pool ratio');
    }
  }
}

testFullFlow().catch(console.error);
