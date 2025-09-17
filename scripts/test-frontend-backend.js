const { ethers } = require('hardhat');
const fs = require('fs');
const path = require('path');

async function testFrontendBackend() {
  console.log('🔍 Testing Frontend-Backend Connection');
  console.log('=====================================');
  
  const [deployer] = await ethers.getSigners();
  console.log('Deployer:', deployer.address);
  
  // Read frontend constants
  const addressesPath = path.join(__dirname, '../../frontend/src/constants/generated/addresses.local.json');
  const addresses = JSON.parse(fs.readFileSync(addressesPath, 'utf8'));
  const contracts = addresses['31337'];
  
  console.log('\n📋 Frontend Constants:');
  console.log('Factory:', contracts.QuantumSwapFactory);
  console.log('Router:', contracts.QuantumSwapRouter);
  console.log('WETH:', contracts.WETH);
  
  // Get contracts
  const factory = await ethers.getContractAt('QuantumSwapFactory', contracts.QuantumSwapFactory);
  const router = await ethers.getContractAt('QuantumSwapRouter', contracts.QuantumSwapRouter);
  
  // Test WETH/DAI pair
  const wethToken = contracts.tokens.find(t => t.symbol === 'WETH');
  const daiToken = contracts.tokens.find(t => t.symbol === 'DAI');
  
  console.log('\n🪙 Token Info:');
  console.log('WETH:', wethToken.address, 'decimals:', wethToken.decimals);
  console.log('DAI:', daiToken.address, 'decimals:', daiToken.decimals);
  
  // Check if pair exists
  const pairAddress = await factory.getPair(wethToken.address, daiToken.address);
  console.log('\n🏊 Pair Address from Factory:', pairAddress);
  
  if (pairAddress === ethers.ZeroAddress) {
    console.log('❌ Pair does not exist!');
    return;
  }
  
  // Get pair contract
  const pairContract = await ethers.getContractAt('QuantumSwapPair', pairAddress);
  
  // Get pair info
  const token0Address = await pairContract.token0();
  const token1Address = await pairContract.token1();
  const reserves = await pairContract.getReserves();
  const totalSupply = await pairContract.totalSupply();
  
  console.log('\n📊 Pair Info:');
  console.log('Token0:', token0Address);
  console.log('Token1:', token1Address);
  console.log('Reserves:', reserves.map(r => ethers.formatUnits(r, 18)));
  console.log('Total Supply:', ethers.formatUnits(totalSupply, 18));
  
  // Check which token is which
  let reserveA, reserveB, tokenASymbol, tokenBSymbol;
  if (token0Address.toLowerCase() === wethToken.address.toLowerCase()) {
    reserveA = reserves[0];
    reserveB = reserves[1];
    tokenASymbol = 'WETH';
    tokenBSymbol = 'DAI';
  } else {
    reserveA = reserves[1];
    reserveB = reserves[0];
    tokenASymbol = 'DAI';
    tokenBSymbol = 'WETH';
  }
  
  console.log('\n🔄 Pool Ratio:');
  console.log(`${tokenASymbol} Reserve:`, ethers.formatUnits(reserveA, 18));
  console.log(`${tokenBSymbol} Reserve:`, ethers.formatUnits(reserveB, 18));
  console.log(`Ratio (${tokenASymbol}/${tokenBSymbol}):`, Number(ethers.formatUnits(reserveA, 18)) / Number(ethers.formatUnits(reserveB, 18)));
  
  // Test frontend logic
  console.log('\n🧪 Testing Frontend Logic:');
  
  // Simulate frontend amount A input
  const amountAInput = '10'; // 10 WETH
  const amountAWei = ethers.parseUnits(amountAInput, 18);
  
  console.log(`Input: ${amountAInput} ${tokenASymbol}`);
  
  // Calculate optimal amount B (frontend logic)
  const amountBOptimal = (amountAWei * reserveB) / reserveA;
  const amountBFormatted = ethers.formatUnits(amountBOptimal, 18);
  
  console.log(`Optimal ${tokenBSymbol}:`, amountBFormatted);
  
  // Test with different amounts
  console.log('\n📈 Test Different Amounts:');
  const testAmounts = ['1', '5', '10', '50', '100'];
  
  for (const amount of testAmounts) {
    const amountWei = ethers.parseUnits(amount, 18);
    const optimalB = (amountWei * reserveB) / reserveA;
    const optimalBFormatted = ethers.formatUnits(optimalB, 18);
    
    console.log(`${amount} ${tokenASymbol} → ${optimalBFormatted} ${tokenBSymbol}`);
  }
  
  // Check if frontend can read this data
  console.log('\n🔍 Frontend Read Test:');
  try {
    // Simulate frontend reading reserves
    const frontendReserves = await pairContract.getReserves();
    console.log('✅ Frontend can read reserves:', frontendReserves.map(r => r.toString()));
    
    // Simulate frontend reading total supply
    const frontendTotalSupply = await pairContract.totalSupply();
    console.log('✅ Frontend can read total supply:', frontendTotalSupply.toString());
    
    // Simulate frontend reading token addresses
    const frontendToken0 = await pairContract.token0();
    const frontendToken1 = await pairContract.token1();
    console.log('✅ Frontend can read token0:', frontendToken0);
    console.log('✅ Frontend can read token1:', frontendToken1);
    
  } catch (error) {
    console.error('❌ Frontend read error:', error.message);
  }
  
  console.log('\n✅ Frontend-Backend connection test completed!');
}

testFrontendBackend()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
