import { ethers } from "hardhat";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  const me = await deployer.getAddress();

  const Factory = await ethers.getContractFactory("QuantumSwapFactory");
  const factory = await Factory.deploy(me); await factory.waitForDeployment();
  const factoryAddr = await factory.getAddress();

  const WETH9 = await ethers.getContractFactory("WETH9");
  const weth = await WETH9.deploy(); await weth.waitForDeployment();
  const wethAddr = await weth.getAddress();

  const Router = await ethers.getContractFactory("QuantumSwapRouter");
  const router = await Router.deploy(factoryAddr, wethAddr); await router.waitForDeployment();
  const routerAddr = await router.getAddress();

  const Mock = await ethers.getContractFactory("MockERC20");
  const specs = [
    { name: "USD Coin",      symbol: "USDC", decimals: 6,  mint: "1000000" },
    { name: "Tether USD",    symbol: "USDT", decimals: 6,  mint: "1000000" },
    { name: "Dai",            symbol: "DAI",  decimals: 18, mint: "1000000" },
    { name: "Wrapped Bitcoin",symbol: "WBTC", decimals: 8,  mint: "10000"   },
    { name: "Chainlink",      symbol: "LINK", decimals: 18, mint: "1000000" },
    { name: "Uniswap",        symbol: "UNI",  decimals: 18, mint: "1000000" },
  ] as const;
  const deployed: Record<string, { address: string; decimals: number; name: string; symbol: string }> = {};
  for (const s of specs) {
    const t = await Mock.deploy(s.name, s.symbol, s.decimals); await t.waitForDeployment();
    await t.mint(me, ethers.parseUnits(s.mint, s.decimals));
    deployed[s.symbol] = { address: await t.getAddress(), decimals: s.decimals, name: s.name, symbol: s.symbol };
  }
  const usdcAddr = deployed["USDC"].address;
  const daiAddr  = deployed["DAI"].address;

  // Approvals for a few tokens
  for (const sym of ["USDC","USDT","DAI","WBTC","LINK","UNI"]) {
    const t = await ethers.getContractAt("MockERC20", deployed[sym].address);
    await (await t.approve(routerAddr, ethers.MaxUint256)).wait();
  }
  // Mint some WETH by depositing ETH
  await (await weth.deposit({ value: ethers.parseEther("1000") })).wait();
  await (await weth.approve(routerAddr, ethers.MaxUint256)).wait();
  // Provide initial liquidity for common pools
  const deadline = BigInt(Math.floor(Date.now()/1000) + 1800);
  await (await router.addLiquidity(usdcAddr, daiAddr, ethers.parseUnits("1000", 6), ethers.parseUnits("1000", 18), 0n, 0n, me, deadline)).wait();
  await (await router.addLiquidity(wethAddr, daiAddr, ethers.parseUnits("100", 18), ethers.parseUnits("200000", 18), 0n, 0n, me, deadline)).wait();
  await (await router.addLiquidity(wethAddr, usdcAddr, ethers.parseUnits("50", 18), ethers.parseUnits("100000", 6), 0n, 0n, me, deadline)).wait();

  const logoFor = (symbol: string): string | undefined => {
    const s = symbol.toUpperCase();
    const map: Record<string, string> = {
      WETH: "/tokens/weth.svg",
      ETH: "/tokens/eth.svg",
      USDC: "/tokens/usdc.svg",
      USDT: "/tokens/usdt.svg",
      DAI: "/tokens/dai.svg",
      WBTC: "/tokens/wbtc.svg",
      LINK: "/tokens/link.svg",
      UNI: "/tokens/uni.svg",
    };
    return map[s];
  };

  const tokensOut = [
    { address: wethAddr, symbol: "WETH", name: "Wrapped Ether", decimals: 18, logoURI: logoFor("WETH") },
    ...Object.values(deployed).map((d) => ({ ...d, logoURI: logoFor(d.symbol) })),
  ];

  const out = {
    31337: {
      QuantumSwapFactory: factoryAddr,
      QuantumSwapRouter: routerAddr,
      WETH: wethAddr,
      tokens: tokensOut,
    },
  };

  const dir = join(__dirname, "../../frontend/src/constants/generated");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "addresses.local.json"), JSON.stringify(out, null, 2));

  console.log("Deployed:", out[31337]);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


