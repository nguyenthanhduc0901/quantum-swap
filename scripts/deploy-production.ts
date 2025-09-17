import { ethers, network } from "hardhat";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

async function main() {
  console.log(`\n===== QuantumSwap Production Deployment =====`);
  console.log(`Network: ${network.name}`);
  console.log(`Chain ID: ${network.config.chainId}`);

  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Deploying contracts with the account: ${deployer.address}`);
  console.log(`Account balance: ${ethers.formatEther(balance)} ETH`);

  // Check if we have enough ETH for deployment
  const estimatedGas = ethers.parseEther("0.1"); // Rough estimate
  if (balance < estimatedGas) {
    throw new Error(`Insufficient balance. Need at least ${ethers.formatEther(estimatedGas)} ETH`);
  }

  const deploymentResults: any = {};

  try {
    // 1. Deploy QuantumSwapFactory
    console.log("\n1. Deploying QuantumSwapFactory...");
    const Factory = await ethers.getContractFactory("QuantumSwapFactory");
    const factory = await Factory.deploy(deployer.address);
    await factory.waitForDeployment();
    const factoryAddress = await factory.getAddress();
    console.log(`✅ QuantumSwapFactory deployed to: ${factoryAddress}`);
    deploymentResults.factory = factoryAddress;

    // 2. Deploy WETH (only if not mainnet)
    let wethAddress: string;
    if (network.config.chainId === 1) {
      // Use canonical WETH on mainnet
      wethAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
      console.log(`✅ Using canonical WETH on mainnet: ${wethAddress}`);
    } else {
      console.log("\n2. Deploying WETH...");
      const WETH9 = await ethers.getContractFactory("WETH9");
      const weth = await WETH9.deploy();
      await weth.waitForDeployment();
      wethAddress = await weth.getAddress();
      console.log(`✅ WETH deployed to: ${wethAddress}`);
    }
    deploymentResults.weth = wethAddress;

    // 3. Deploy QuantumSwapRouter
    console.log("\n3. Deploying QuantumSwapRouter...");
    const Router = await ethers.getContractFactory("QuantumSwapRouter");
    const router = await Router.deploy(factoryAddress, wethAddress);
    await router.waitForDeployment();
    const routerAddress = await router.getAddress();
    console.log(`✅ QuantumSwapRouter deployed to: ${routerAddress}`);
    deploymentResults.router = routerAddress;

    // 4. Deploy SecurityAudit
    console.log("\n4. Deploying SecurityAudit...");
    const SecurityAudit = await ethers.getContractFactory("SecurityAudit");
    const securityAudit = await SecurityAudit.deploy(factoryAddress, deployer.address);
    await securityAudit.waitForDeployment();
    const securityAuditAddress = await securityAudit.getAddress();
    console.log(`✅ SecurityAudit deployed to: ${securityAuditAddress}`);
    deploymentResults.securityAudit = securityAuditAddress;

    // 5. Verify contracts (if not local network)
    if (network.name !== "hardhat" && network.name !== "localhost") {
      console.log("\n5. Verifying contracts on Etherscan...");
      
      try {
        await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds
        
        console.log("Verifying QuantumSwapFactory...");
        await hre.run("verify:verify", {
          address: factoryAddress,
          constructorArguments: [deployer.address],
        });
        console.log("✅ QuantumSwapFactory verified");

        if (network.config.chainId !== 1) {
          console.log("Verifying WETH...");
          await hre.run("verify:verify", {
            address: wethAddress,
            constructorArguments: [],
          });
          console.log("✅ WETH verified");
        }

        console.log("Verifying QuantumSwapRouter...");
        await hre.run("verify:verify", {
          address: routerAddress,
          constructorArguments: [factoryAddress, wethAddress],
        });
        console.log("✅ QuantumSwapRouter verified");

        console.log("Verifying SecurityAudit...");
        await hre.run("verify:verify", {
          address: securityAuditAddress,
          constructorArguments: [factoryAddress, deployer.address],
        });
        console.log("✅ SecurityAudit verified");

      } catch (error) {
        console.log("⚠️ Verification failed:", error);
        console.log("You can verify manually later using:");
        console.log(`npx hardhat verify --network ${network.name} ${factoryAddress} "${deployer.address}"`);
        console.log(`npx hardhat verify --network ${network.name} ${routerAddress} "${factoryAddress}" "${wethAddress}"`);
        console.log(`npx hardhat verify --network ${network.name} ${securityAuditAddress} "${factoryAddress}" "${deployer.address}"`);
      }
    }

    // 6. Save deployment results
    const deploymentData = {
      network: network.name,
      chainId: network.config.chainId,
      timestamp: new Date().toISOString(),
      deployer: deployer.address,
      contracts: deploymentResults,
    };

    // Save to file
    const outputDir = join(__dirname, "../deployments");
    mkdirSync(outputDir, { recursive: true });
    const outputFile = join(outputDir, `${network.name}-${Date.now()}.json`);
    writeFileSync(outputFile, JSON.stringify(deploymentData, null, 2));
    console.log(`\n📄 Deployment data saved to: ${outputFile}`);

    // 7. Generate frontend addresses file
    const frontendData = {
      [network.config.chainId as number]: {
        QuantumSwapFactory: factoryAddress,
        QuantumSwapRouter: routerAddress,
        WETH: wethAddress,
        SecurityAudit: securityAuditAddress,
      },
    };

    const frontendDir = join(__dirname, "../../frontend/src/constants/generated");
    mkdirSync(frontendDir, { recursive: true });
    const frontendFile = join(frontendDir, `addresses.${network.name}.json`);
    writeFileSync(frontendFile, JSON.stringify(frontendData, null, 2));
    console.log(`📄 Frontend addresses saved to: ${frontendFile}`);

    console.log("\n🎉 Deployment completed successfully!");
    console.log("\n📋 Deployment Summary:");
    console.log(`   Factory: ${factoryAddress}`);
    console.log(`   Router: ${routerAddress}`);
    console.log(`   WETH: ${wethAddress}`);
    console.log(`   SecurityAudit: ${securityAuditAddress}`);

    console.log("\n🔗 Next Steps:");
    console.log("1. Transfer ownership to multisig (if applicable)");
    console.log("2. Set up monitoring and alerts");
    console.log("3. Create initial liquidity pools");
    console.log("4. Update frontend configuration");

  } catch (error) {
    console.error("\n❌ Deployment failed:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});


