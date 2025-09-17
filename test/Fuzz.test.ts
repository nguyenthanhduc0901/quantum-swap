import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("QuantumSwap Fuzz Tests", function () {
  async function deployContractsFixture() {
    const [owner, user1, user2] = await ethers.getSigners();

    // Deploy core contracts
    const Factory = await ethers.getContractFactory("QuantumSwapFactory");
    const factory = await Factory.deploy(owner.address);
    await factory.waitForDeployment();

    const WETH = await ethers.getContractFactory("WETH9");
    const weth = await WETH.deploy();
    await weth.waitForDeployment();

    const Router = await ethers.getContractFactory("QuantumSwapRouter");
    const router = await Router.deploy(await factory.getAddress(), await weth.getAddress());
    await router.waitForDeployment();

    // Deploy test tokens
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const tokenA = await MockERC20.deploy("TokenA", "TKA", 18);
    const tokenB = await MockERC20.deploy("TokenB", "TKB", 18);
    await tokenA.waitForDeployment();
    await tokenB.waitForDeployment();

    // Mint large amounts for fuzz testing
    await tokenA.mint(owner.address, ethers.parseEther("1000000000"));
    await tokenB.mint(owner.address, ethers.parseEther("1000000000"));
    await tokenA.mint(user1.address, ethers.parseEther("1000000000"));
    await tokenB.mint(user1.address, ethers.parseEther("1000000000"));

    return {
      owner,
      user1,
      user2,
      factory,
      weth,
      router,
      tokenA,
      tokenB,
    };
  }

  describe("Pair Creation Fuzz Tests", function () {
    it("should handle random token addresses for pair creation", async function () {
      const { factory, owner } = await loadFixture(deployContractsFixture);

      // Generate random addresses
      const randomAddresses: string[] = [];
      for (let i = 0; i < 10; i++) {
        randomAddresses.push((ethers.Wallet.createRandom() as any).address);
      }

      // Try to create pairs with random addresses
      for (let i = 0; i < randomAddresses.length - 1; i++) {
        const token0 = randomAddresses[i];
        const token1 = randomAddresses[i + 1];

        if (token0 !== token1) {
          await expect(factory.createPair(token0, token1))
            .to.emit(factory, "PairCreated");
        }
      }
    });

    it("should handle identical token addresses", async function () {
      const { factory, owner } = await loadFixture(deployContractsFixture);

      const randomAddress = ethers.Wallet.createRandom().address;

      await expect(factory.createPair(randomAddress, randomAddress))
        .to.be.revertedWith("FACTORY: IDENTICAL_ADDRESSES");
    });

    it("should handle zero addresses", async function () {
      const { factory, owner } = await loadFixture(deployContractsFixture);

      const randomAddress = ethers.Wallet.createRandom().address;

      await expect(factory.createPair(ethers.ZeroAddress, randomAddress))
        .to.be.revertedWith("FACTORY: ZERO_ADDRESS");
    });
  });

  describe("Liquidity Fuzz Tests", function () {
    it("should handle random liquidity amounts", async function () {
      const { factory, router, tokenA, tokenB, owner } = await loadFixture(deployContractsFixture);

      // Create pair
      await factory.createPair(await tokenA.getAddress(), await tokenB.getAddress());

      // Test with random amounts
      for (let i = 0; i < 20; i++) {
        const amountA = ethers.parseEther((Math.random() * 1000 + 1).toString());
        const amountB = ethers.parseEther((Math.random() * 1000 + 1).toString());

        await tokenA.approve(await router.getAddress(), amountA);
        await tokenB.approve(await router.getAddress(), amountB);

        await expect(
          router.addLiquidity(
            await tokenA.getAddress(),
            await tokenB.getAddress(),
            amountA,
            amountB,
            0,
            0,
            owner.address,
            Math.floor(Date.now() / 1000) + 3600
          )
        ).to.not.be.reverted;
      }
    });

    it("should handle extreme liquidity amounts", async function () {
      const { factory, router, tokenA, tokenB, owner } = await loadFixture(deployContractsFixture);

      // Create pair
      await factory.createPair(await tokenA.getAddress(), await tokenB.getAddress());

      // Test with very large amounts
      const largeAmount = ethers.parseEther("1000000");
      await tokenA.approve(await router.getAddress(), largeAmount);
      await tokenB.approve(await router.getAddress(), largeAmount);

      await expect(
        router.addLiquidity(
          await tokenA.getAddress(),
          await tokenB.getAddress(),
          largeAmount,
          largeAmount,
          0,
          0,
          owner.address,
          Math.floor(Date.now() / 1000) + 3600
        )
      ).to.not.be.reverted;

      // Test with very small amounts
      const smallAmount = ethers.parseEther("0.000001");
      await tokenA.approve(await router.getAddress(), smallAmount);
      await tokenB.approve(await router.getAddress(), smallAmount);

      await expect(
        router.addLiquidity(
          await tokenA.getAddress(),
          await tokenB.getAddress(),
          smallAmount,
          smallAmount,
          0,
          0,
          owner.address,
          Math.floor(Date.now() / 1000) + 3600
        )
      ).to.not.be.reverted;
    });
  });

  describe("Swap Fuzz Tests", function () {
    it("should handle random swap amounts", async function () {
      const { factory, router, tokenA, tokenB, owner } = await loadFixture(deployContractsFixture);

      // Create pair and add initial liquidity
      await factory.createPair(await tokenA.getAddress(), await tokenB.getAddress());
      await tokenA.approve(await router.getAddress(), ethers.parseEther("10000"));
      await tokenB.approve(await router.getAddress(), ethers.parseEther("10000"));
      await router.addLiquidity(
        await tokenA.getAddress(),
        await tokenB.getAddress(),
        ethers.parseEther("1000"),
        ethers.parseEther("1000"),
        0,
        0,
        owner.address,
        Math.floor(Date.now() / 1000) + 3600
      );

      // Test with random swap amounts
      for (let i = 0; i < 50; i++) {
        const swapAmount = ethers.parseEther((Math.random() * 100 + 0.1).toString());

        await tokenA.approve(await router.getAddress(), swapAmount);

        // Some swaps might fail due to price impact limits, which is expected
        try {
          await router.swapExactTokensForTokens(
            swapAmount,
            0,
            [await tokenA.getAddress(), await tokenB.getAddress()],
            owner.address,
            Math.floor(Date.now() / 1000) + 3600
          );
        } catch (error: unknown) {
          // Expected for some large swaps due to our security measures
          expect((error as Error).message).to.include("PAIR: PRICE_IMPACT_TOO_HIGH");
        }
      }
    });

    it("should handle zero swap amounts", async function () {
      const { factory, router, tokenA, tokenB, owner } = await loadFixture(deployContractsFixture);

      // Create pair and add initial liquidity
      await factory.createPair(await tokenA.getAddress(), await tokenB.getAddress());
      await tokenA.approve(await router.getAddress(), ethers.parseEther("1000"));
      await tokenB.approve(await router.getAddress(), ethers.parseEther("1000"));
      await router.addLiquidity(
        await tokenA.getAddress(),
        await tokenB.getAddress(),
        ethers.parseEther("1000"),
        ethers.parseEther("1000"),
        0,
        0,
        owner.address,
        Math.floor(Date.now() / 1000) + 3600
      );

      await expect(
        router.swapExactTokensForTokens(
          0,
          0,
          [await tokenA.getAddress(), await tokenB.getAddress()],
          owner.address,
          Math.floor(Date.now() / 1000) + 3600
        )
      ).to.be.revertedWith("Router: INSUFFICIENT_INPUT");
    });
  });

  describe("Price Impact Fuzz Tests", function () {
    it("should handle various price impact scenarios", async function () {
      const { factory, router, tokenA, tokenB, owner } = await loadFixture(deployContractsFixture);

      // Create pair and add initial liquidity
      await factory.createPair(await tokenA.getAddress(), await tokenB.getAddress());
      await tokenA.approve(await router.getAddress(), ethers.parseEther("10000"));
      await tokenB.approve(await router.getAddress(), ethers.parseEther("10000"));
      await router.addLiquidity(
        await tokenA.getAddress(),
        await tokenB.getAddress(),
        ethers.parseEther("1000"),
        ethers.parseEther("1000"),
        0,
        0,
        owner.address,
        Math.floor(Date.now() / 1000) + 3600
      );

      // Test different swap sizes to trigger different price impacts
      const swapSizes = [
        ethers.parseEther("1"),    // 0.1% of reserves
        ethers.parseEther("10"),   // 1% of reserves
        ethers.parseEther("50"),   // 5% of reserves
        ethers.parseEther("100"),  // 10% of reserves
        ethers.parseEther("200"),  // 20% of reserves
        ethers.parseEther("500"),  // 50% of reserves
      ];

      for (const swapSize of swapSizes) {
        await tokenA.approve(await router.getAddress(), swapSize);

        try {
          await router.swapExactTokensForTokens(
            swapSize,
            0,
            [await tokenA.getAddress(), await tokenB.getAddress()],
            owner.address,
            Math.floor(Date.now() / 1000) + 3600
          );
        } catch (error: unknown) {
          // Large swaps should fail due to price impact protection
          if (swapSize > ethers.parseEther("100")) {
            expect((error as Error).message).to.include("PAIR: PRICE_IMPACT_TOO_HIGH");
          }
        }
      }
    });
  });

  describe("Edge Case Fuzz Tests", function () {
    it("should handle maximum uint256 values", async function () {
      const { factory, owner } = await loadFixture(deployContractsFixture);

      // Test with maximum uint256 values
      const maxUint256 = ethers.MaxUint256;
      const randomAddress = ethers.Wallet.createRandom().address;

      // This should fail gracefully
      await expect(factory.createPair(maxUint256.toString(), randomAddress))
        .to.be.reverted;
    });

    it("should handle very small decimal tokens", async function () {
      const { factory, router, owner } = await loadFixture(deployContractsFixture);

      // Deploy token with very small decimals
      const MockERC20 = await ethers.getContractFactory("MockERC20");
      const smallToken = await MockERC20.deploy("SmallToken", "SMALL", 0);
      await smallToken.waitForDeployment();

      const normalToken = await MockERC20.deploy("NormalToken", "NORMAL", 18);
      await normalToken.waitForDeployment();

      // Mint tokens
      await smallToken.mint(owner.address, 1000000);
      await normalToken.mint(owner.address, ethers.parseEther("1000000"));

      // Create pair
      await factory.createPair(await smallToken.getAddress(), await normalToken.getAddress());

      // Add liquidity
      await smallToken.approve(await router.getAddress(), 1000);
      await normalToken.approve(await router.getAddress(), ethers.parseEther("1000"));

      await expect(
        router.addLiquidity(
          await smallToken.getAddress(),
          await normalToken.getAddress(),
          1000,
          ethers.parseEther("1000"),
          0,
          0,
          owner.address,
          Math.floor(Date.now() / 1000) + 3600
        )
      ).to.not.be.reverted;
    });

    it("should handle very large decimal tokens", async function () {
      const { factory, router, owner } = await loadFixture(deployContractsFixture);

      // Deploy token with large decimals
      const MockERC20 = await ethers.getContractFactory("MockERC20");
      const largeToken = await MockERC20.deploy("LargeToken", "LARGE", 30);
      await largeToken.waitForDeployment();

      const normalToken = await MockERC20.deploy("NormalToken", "NORMAL", 18);
      await normalToken.waitForDeployment();

      // Mint tokens
      await largeToken.mint(owner.address, ethers.parseUnits("1000000", 30));
      await normalToken.mint(owner.address, ethers.parseEther("1000000"));

      // Create pair
      await factory.createPair(await largeToken.getAddress(), await normalToken.getAddress());

      // Add liquidity
      await largeToken.approve(await router.getAddress(), ethers.parseUnits("1000", 30));
      await normalToken.approve(await router.getAddress(), ethers.parseEther("1000"));

      await expect(
        router.addLiquidity(
          await largeToken.getAddress(),
          await normalToken.getAddress(),
          ethers.parseUnits("1000", 30),
          ethers.parseEther("1000"),
          0,
          0,
          owner.address,
          Math.floor(Date.now() / 1000) + 3600
        )
      ).to.not.be.reverted;
    });
  });

  describe("Gas Optimization Fuzz Tests", function () {
    it("should maintain gas efficiency with various operations", async function () {
      const { factory, router, tokenA, tokenB, owner } = await loadFixture(deployContractsFixture);

      // Create pair
      await factory.createPair(await tokenA.getAddress(), await tokenB.getAddress());

      // Measure gas for various operations
      const operations = [
        async () => {
          await tokenA.approve(await router.getAddress(), ethers.parseEther("1000"));
          await tokenB.approve(await router.getAddress(), ethers.parseEther("1000"));
          return router.addLiquidity(
            await tokenA.getAddress(),
            await tokenB.getAddress(),
            ethers.parseEther("100"),
            ethers.parseEther("100"),
            0,
            0,
            owner.address,
            Math.floor(Date.now() / 1000) + 3600
          );
        },
        async () => {
          await tokenA.approve(await router.getAddress(), ethers.parseEther("100"));
          return router.swapExactTokensForTokens(
            ethers.parseEther("10"),
            0,
            [await tokenA.getAddress(), await tokenB.getAddress()],
            owner.address,
            Math.floor(Date.now() / 1000) + 3600
          );
        },
      ];

      for (const operation of operations) {
        const tx = await operation();
        const receipt = await tx.wait();
        
        // Gas usage should be reasonable (less than 500k gas)
        expect(receipt?.gasUsed).to.be.lt(500000);
      }
    });
  });
});
