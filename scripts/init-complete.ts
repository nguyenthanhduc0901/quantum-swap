import { ethers } from "hardhat";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

async function main() {
  console.log("🚀 QuantumSwap Complete Initialization");
  console.log("=====================================");

  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  console.log("Deployer address:", deployerAddress);

  // Step 1: Deploy core contracts
  console.log("\n📦 Step 1: Deploying core contracts...");
  
  const Factory = await ethers.getContractFactory("QuantumSwapFactory");
  const factory = await Factory.deploy(deployerAddress);
  await factory.waitForDeployment();
  const factoryAddr = await factory.getAddress();
  console.log("✅ Factory deployed at:", factoryAddr);

  const WETH9 = await ethers.getContractFactory("WETH9");
  const weth = await WETH9.deploy();
  await weth.waitForDeployment();
  const wethAddr = await weth.getAddress();
  console.log("✅ WETH deployed at:", wethAddr);

  const Router = await ethers.getContractFactory("QuantumSwapRouter");
  const router = await Router.deploy(factoryAddr, wethAddr);
  await router.waitForDeployment();
  const routerAddr = await router.getAddress();
  console.log("✅ Router deployed at:", routerAddr);

  // Step 2: Deploy and mint tokens
  console.log("\n🪙 Step 2: Deploying and minting tokens...");
  
  const Mock = await ethers.getContractFactory("MockERC20");
  const tokenSpecs = [
    { name: "Dai Stablecoin", symbol: "DAI", decimals: 18, mint: "1000000" },
    { name: "USD Coin", symbol: "USDC", decimals: 6, mint: "1000000" },
    { name: "Tether USD", symbol: "USDT", decimals: 6, mint: "1000000" },
    { name: "ChainLink Token", symbol: "LINK", decimals: 18, mint: "100000" },
    { name: "Uniswap", symbol: "UNI", decimals: 18, mint: "100000" },
    { name: "Aave Token", symbol: "AAVE", decimals: 18, mint: "10000" },
    { name: "Wrapped Bitcoin", symbol: "WBTC", decimals: 8, mint: "1000" },
  ] as const;

  const deployedTokens: Record<string, { address: string; decimals: number; name: string; symbol: string }> = {};
  
  for (const spec of tokenSpecs) {
    const token = await Mock.deploy(spec.name, spec.symbol, spec.decimals);
    await token.waitForDeployment();
    const tokenAddr = await token.getAddress();
    
    await token.mint(deployerAddress, ethers.parseUnits(spec.mint, spec.decimals));
    deployedTokens[spec.symbol] = {
      address: tokenAddr,
      decimals: spec.decimals,
      name: spec.name,
      symbol: spec.symbol
    };
    console.log(`✅ ${spec.symbol} deployed at: ${tokenAddr}`);
  }

  // Mint WETH
  await weth.deposit({ value: ethers.parseEther("1000") });
  console.log("✅ WETH minted: 1000 WETH");

  // Step 3: Approve router for all tokens
  console.log("\n🔐 Step 3: Approving router for all tokens...");
  
  const allTokens = ["WETH", "DAI", "USDC", "USDT", "LINK", "UNI", "AAVE", "WBTC"];
  for (const symbol of allTokens) {
    if (symbol === "WETH") {
      await weth.approve(routerAddr, ethers.MaxUint256);
    } else {
      const token = await ethers.getContractAt("MockERC20", deployedTokens[symbol].address);
      await token.approve(routerAddr, ethers.MaxUint256);
    }
    console.log(`✅ ${symbol} approved for router`);
  }

  // Step 4: Create pairs and add liquidity
  console.log("\n🏊 Step 4: Creating pairs and adding liquidity...");
  
  const pools = [
    { tokenA: "WETH", tokenB: "USDC", amountA: "100", amountB: "200000" },
    { tokenA: "WETH", tokenB: "DAI", amountA: "50", amountB: "100000" },
    { tokenA: "USDC", tokenB: "USDT", amountA: "100000", amountB: "100000" },
    { tokenA: "LINK", tokenB: "WETH", amountA: "1000", amountB: "10" },
    { tokenA: "UNI", tokenB: "WETH", amountA: "500", amountB: "5" },
    { tokenA: "AAVE", tokenB: "WETH", amountA: "100", amountB: "2" },
    { tokenA: "DAI", tokenB: "USDC", amountA: "50000", amountB: "50000" },
    { tokenA: "LINK", tokenB: "USDC", amountA: "500", amountB: "10000" },
    { tokenA: "UNI", tokenB: "USDC", amountA: "200", amountB: "5000" },
    { tokenA: "WBTC", tokenB: "WETH", amountA: "10", amountB: "200" },
  ];

  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
  const createdPools = [];

  for (let i = 0; i < pools.length; i++) {
    const pool = pools[i];
    console.log(`\n📝 Creating ${pool.tokenA}/${pool.tokenB} pool (${i + 1}/${pools.length})...`);
    
    try {
      // Get token addresses
      const tokenAAddr = pool.tokenA === "WETH" ? wethAddr : deployedTokens[pool.tokenA].address;
      const tokenBAddr = pool.tokenB === "WETH" ? wethAddr : deployedTokens[pool.tokenB].address;
      
      // Create pair
      await factory.createPair(tokenAAddr, tokenBAddr);
      const pairAddress = await factory.getPair(tokenAAddr, tokenBAddr);
      console.log(`   ✅ Pair created at: ${pairAddress}`);

      // Calculate amounts
      const tokenADecimals = pool.tokenA === "WETH" ? 18 : deployedTokens[pool.tokenA].decimals;
      const tokenBDecimals = pool.tokenB === "WETH" ? 18 : deployedTokens[pool.tokenB].decimals;
      const amountA = ethers.parseUnits(pool.amountA, tokenADecimals);
      const amountB = ethers.parseUnits(pool.amountB, tokenBDecimals);

      // Add liquidity
      await router.addLiquidity(
        tokenAAddr,
        tokenBAddr,
        amountA,
        amountB,
        0n, // min amount A
        0n, // min amount B
        deployerAddress,
        deadline
      );
      console.log(`   ✅ Liquidity added: ${pool.amountA} ${pool.tokenA} / ${pool.amountB} ${pool.tokenB}`);

      createdPools.push({
        pair: `${pool.tokenA}/${pool.tokenB}`,
        address: pairAddress,
        tokenA: { symbol: pool.tokenA, address: tokenAAddr },
        tokenB: { symbol: pool.tokenB, address: tokenBAddr }
      });

    } catch (error) {
      console.error(`   ❌ Error creating ${pool.tokenA}/${pool.tokenB} pool:`, error);
    }
  }

  // Step 5: Generate frontend constants
  console.log("\n🔄 Step 5: Generating frontend constants...");
  
  const logoFor = (symbol: string): string | undefined => {
    const s = symbol.toUpperCase();
    const map: Record<string, string> = {
      WETH: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png",
      ETH: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png",
      USDC: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png",
      USDT: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png",
      DAI: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x6B175474E89094C44Da98b954EedeAC495271d0F/logo.png",
      WBTC: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599/logo.png",
      LINK: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x514910771AF9Ca656af840dff83E8264EcF986CA/logo.png",
      UNI: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984/logo.png",
      AAVE: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9/logo.png",
    };
    return map[s];
  };

  const tokensOut = [
    { address: wethAddr, symbol: "WETH", name: "Wrapped Ether", decimals: 18, logoURI: logoFor("WETH") },
    ...Object.values(deployedTokens).map((d) => ({ ...d, logoURI: logoFor(d.symbol) })),
  ];

  const output = {
    31337: {
      QuantumSwapFactory: factoryAddr,
      QuantumSwapRouter: routerAddr,
      WETH: wethAddr,
      tokens: tokensOut,
      pools: createdPools
    },
  };

  // Write to frontend constants
  const frontendDir = join(__dirname, "../../frontend/src/constants/generated");
  mkdirSync(frontendDir, { recursive: true });
  writeFileSync(join(frontendDir, "addresses.local.json"), JSON.stringify(output, null, 2));
  console.log("✅ Frontend constants generated");

  // Summary
  console.log("\n🎉 QuantumSwap Complete Initialization Finished!");
  console.log("=====================================");
  console.log("✅ Core contracts deployed");
  console.log("✅ 7 tokens deployed and minted");
  console.log("✅ 10 pools created with liquidity");
  console.log("✅ Frontend constants generated");
  console.log("\n📋 Contract addresses:");
  console.log("   Factory:", factoryAddr);
  console.log("   Router:", routerAddr);
  console.log("   WETH:", wethAddr);
  console.log("\n🏊 Created pools:");
  createdPools.forEach((pool, index) => {
    console.log(`   ${index + 1}. ${pool.pair} - ${pool.address}`);
  });
  console.log("\n🚀 Ready for frontend development!");
}

main().catch((e) => {
  console.error("❌ Error:", e);
  process.exit(1);
});

