const { ethers } = require('hardhat');
const fs = require('fs');
const path = require('path');

async function testUniDai() {
  console.log('🔍 Testing UNI/DAI Pair (Created from Frontend)');
  console.log('===============================================');
  
  const [deployer] = await ethers.getSigners();
  console.log('Deployer:', deployer.address);
  
  // Read frontend constants
  const addressesPath = path.join(__dirname, '../../frontend/src/constants/generated/addresses.local.json');
  const addresses = JSON.parse(fs.readFileSync(addressesPath, 'utf8'));
  const contracts = addresses['31337'];
  
  console.log('\n📋 Frontend Constants:');
  console.log('Factory:', contracts.QuantumSwapFactory);
  console.log('Router:', contracts.QuantumSwapRouter);
  
  // Get contracts
  const factory = await ethers.getContractAt('QuantumSwapFactory', contracts.QuantumSwapFactory);
  const router = await ethers.getContractAt('QuantumSwapRouter', contracts.QuantumSwapRouter);
  
  // Get UNI and DAI tokens
  const uniToken = contracts.tokens.find(t => t.symbol === 'UNI');
  const daiToken = contracts.tokens.find(t => t.symbol === 'DAI');
  
  console.log('\n🪙 Token Info:');
  console.log('UNI:', uniToken.address, 'decimals:', uniToken.decimals);
  console.log('DAI:', daiToken.address, 'decimals:', daiToken.decimals);
  
  // Check if UNI/DAI pair exists
  const pairAddress = await factory.getPair(uniToken.address, daiToken.address);
  console.log('\n🏊 UNI/DAI Pair Address from Factory:', pairAddress);
  
  if (pairAddress === ethers.ZeroAddress) {
    console.log('❌ UNI/DAI pair does not exist!');
    console.log('This means the frontend pair creation failed.');
    return;
  }
  
  console.log('✅ UNI/DAI pair exists!');
  
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
  let reserveA, reserveB, tokenASymbol, tokenBSymbol, tokenAAddress, tokenBAddress;
  if (token0Address.toLowerCase() === uniToken.address.toLowerCase()) {
    reserveA = reserves[0];
    reserveB = reserves[1];
    tokenASymbol = 'UNI';
    tokenBSymbol = 'DAI';
    tokenAAddress = uniToken.address;
    tokenBAddress = daiToken.address;
  } else {
    reserveA = reserves[1];
    reserveB = reserves[0];
    tokenASymbol = 'DAI';
    tokenBSymbol = 'UNI';
    tokenAAddress = daiToken.address;
    tokenBAddress = uniToken.address;
  }
  
  console.log('\n🔄 Pool Ratio:');
  console.log(`${tokenASymbol} Reserve:`, ethers.formatUnits(reserveA, 18));
  console.log(`${tokenBSymbol} Reserve:`, ethers.formatUnits(reserveB, 18));
  console.log(`Ratio (${tokenASymbol}/${tokenBSymbol}):`, Number(ethers.formatUnits(reserveA, 18)) / Number(ethers.formatUnits(reserveB, 18)));
  
  // Check if pool has liquidity
  if (reserveA === 0n && reserveB === 0n) {
    console.log('\n⚠️  Pool exists but has NO LIQUIDITY!');
    console.log('This explains why frontend cannot auto-calculate amounts.');
    console.log('The pool was created but no initial liquidity was added.');
    
    // Test adding initial liquidity
    console.log('\n🧪 Testing Initial Liquidity Addition:');
    
    // Check balances
    const uniContract = await ethers.getContractAt('ERC20', uniToken.address);
    const daiContract = await ethers.getContractAt('ERC20', daiToken.address);
    
    const uniBalance = await uniContract.balanceOf(deployer.address);
    const daiBalance = await daiContract.balanceOf(deployer.address);
    
    console.log('UNI Balance:', ethers.formatUnits(uniBalance, 18));
    console.log('DAI Balance:', ethers.formatUnits(daiBalance, 18));
    
    if (uniBalance > 0n && daiBalance > 0n) {
      console.log('\n💧 Adding initial liquidity...');
      
      // Add small amount of liquidity
      const amountA = ethers.parseUnits('100', 18); // 100 UNI
      const amountB = ethers.parseUnits('1000', 18); // 1000 DAI
      const amountAMin = amountA * 95n / 100n; // 5% slippage
      const amountBMin = amountB * 95n / 100n; // 5% slippage
      const deadline = Math.floor(Date.now() / 1000) + 1800; // 30 minutes
      
      console.log('Amount A (UNI):', ethers.formatUnits(amountA, 18));
      console.log('Amount B (DAI):', ethers.formatUnits(amountB, 18));
      console.log('Amount A Min:', ethers.formatUnits(amountAMin, 18));
      console.log('Amount B Min:', ethers.formatUnits(amountBMin, 18));
      
      try {
        // Approve tokens
        await uniContract.approve(router.target, amountA);
        await daiContract.approve(router.target, amountB);
        console.log('✅ Tokens approved');
        
        // Add liquidity
        const tx = await router.addLiquidity(
          tokenAAddress,
          tokenBAddress,
          amountA,
          amountB,
          amountAMin,
          amountBMin,
          deployer.address,
          deadline
        );
        
        console.log('✅ Initial liquidity added!');
        console.log('Transaction:', tx.hash);
        
        // Wait for transaction
        await tx.wait();
        
        // Check new reserves
        const newReserves = await pairContract.getReserves();
        console.log('\n📊 New Reserves:');
        console.log('Reserve0:', ethers.formatUnits(newReserves[0], 18));
        console.log('Reserve1:', ethers.formatUnits(newReserves[1], 18));
        
        console.log('\n✅ Pool now has liquidity! Frontend should work now.');
        
      } catch (error) {
        console.error('❌ Failed to add initial liquidity:', error.message);
      }
    } else {
      console.log('❌ Insufficient token balances to add liquidity');
    }
    
  } else {
    console.log('\n✅ Pool has liquidity!');
    
    // Test frontend logic with existing liquidity
    console.log('\n🧪 Testing Frontend Logic:');
    
    const amountAInput = '10'; // 10 UNI
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
  }
  
  console.log('\n✅ UNI/DAI pair test completed!');
}

testUniDai()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
