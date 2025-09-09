import { ethers, network } from "hardhat";

async function main() {
	console.log(`\n===== QuantumSwap Deployment =====`);

	const [deployer] = await ethers.getSigners();
	const balance = await ethers.provider.getBalance(deployer.address);
	console.log(`Deploying contracts with the account: ${deployer.address}`);
	console.log(`Account balance: ${ethers.formatEther(balance)} ETH`);
	console.log(`Network: ${network.name}`);

	console.log("\nDeploying QuantumSwapFactory...");
	const Factory = await ethers.getContractFactory("QuantumSwapFactory");
	const factory = await Factory.deploy(deployer.address);
	await factory.waitForDeployment();
	const factoryAddress = await factory.getAddress();
	console.log(`QuantumSwapFactory deployed to: ${factoryAddress}`);

	console.log("\nDeploying WETH...");
	const WETH9 = await ethers.getContractFactory("WETH9");
	const weth = await WETH9.deploy();
	await weth.waitForDeployment();
	const wethAddress = await weth.getAddress();
	console.log(`WETH deployed to: ${wethAddress}`);

	console.log("\nDeploying QuantumSwapRouter...");
	const Router = await ethers.getContractFactory("QuantumSwapRouter");
	const router = await Router.deploy(factoryAddress, wethAddress);
	await router.waitForDeployment();
	const routerAddress = await router.getAddress();
	console.log(`QuantumSwapRouter deployed to: ${routerAddress}`);

	console.log("\nDeployment complete.\n");
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
