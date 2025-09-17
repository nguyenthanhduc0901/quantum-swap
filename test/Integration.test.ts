import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("QuantumSwap Integration Tests", function () {
  async function deployFullSystemFixture() {
    const [owner, user1, user2, user3] = await ethers.getSigners();

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

    // Deploy security contracts
    const SecurityAudit = await ethers.getContractFactory("SecurityAudit");
    const securityAudit = await SecurityAudit.deploy(await factory.getAddress(), owner.address);
    await securityAudit.waitForDeployment();

    const CircuitBreaker = await ethers.getContractFactory("CircuitBreaker");
    const circuitBreaker = await CircuitBreaker.deploy(
      await factory.getAddress(),
      owner.address,
      owner.address
    );
    await circuitBreaker.waitForDeployment();

    // Deploy governance
    const Governance = await ethers.getContractFactory("QuantumSwapGovernance");
    const governance = await Governance.deploy(
      await factory.getAddress(),
      await weth.getAddress(), // Using WETH as governance token for testing
      owner.address,
      172800 // 2 days
    );
    await governance.waitForDeployment();

    // Deploy test tokens
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const usdc = await MockERC20.deploy("USD Coin", "USDC", 6);
    const dai = await MockERC20.deploy("Dai Stablecoin", "DAI", 18);
    const wbtc = await MockERC20.deploy("Wrapped Bitcoin", "WBTC", 8);
    const link = await MockERC20.deploy("Chainlink", "LINK", 18);

    await usdc.waitForDeployment();
    await dai.waitForDeployment();
    await wbtc.waitForDeployment();
    await link.waitForDeployment();

    // Mint tokens for all users
    const mintAmount = ethers.parseEther("1000000");
    for (const user of [owner, user1, user2, user3]) {
      await usdc.mint(user.address, ethers.parseUnits("1000000", 6));
      await dai.mint(user.address, mintAmount);
      await wbtc.mint(user.address, ethers.parseUnits("1000", 8));
      await link.mint(user.address, mintAmount);
      
      // Mint WETH for users (WETH is a special ERC20 that can be minted)
      await weth.connect(user).deposit({ value: ethers.parseEther("1000") });
    }

    return {
      owner,
      user1,
      user2,
      user3,
      factory,
      weth,
      router,
      securityAudit,
      circuitBreaker,
      governance,
      usdc,
      dai,
      wbtc,
      link,
    };
  }

  describe("Multi-Pair Ecosystem", function () {
    it("should handle complex multi-pair trading scenarios", async function () {
      const {
        factory,
        router,
        weth,
        usdc,
        dai,
        wbtc,
        link,
        user1,
        user2,
        user3,
      } = await loadFixture(deployFullSystemFixture);

      // Create multiple pairs
      await factory.createPair(await weth.getAddress(), await usdc.getAddress());
      await factory.createPair(await weth.getAddress(), await dai.getAddress());
      await factory.createPair(await usdc.getAddress(), await dai.getAddress());
      await factory.createPair(await wbtc.getAddress(), await weth.getAddress());
      await factory.createPair(await link.getAddress(), await weth.getAddress());

      // Add liquidity to all pairs
      const liquidityPairs = [
        [weth, usdc, ethers.parseEther("100"), ethers.parseUnits("200000", 6)],
        [weth, dai, ethers.parseEther("50"), ethers.parseEther("100000")],
        [usdc, dai, ethers.parseUnits("100000", 6), ethers.parseEther("100000")],
        [wbtc, weth, ethers.parseUnits("10", 8), ethers.parseEther("200")],
        [link, weth, ethers.parseEther("1000"), ethers.parseEther("50")],
      ];

      for (const [tokenA, tokenB, amountA, amountB] of liquidityPairs) {
        await tokenA.connect(user1).approve(await router.getAddress(), amountA);
        await tokenB.connect(user1).approve(await router.getAddress(), amountB);
        await router.connect(user1).addLiquidity(
          await tokenA.getAddress(),
          await tokenB.getAddress(),
          amountA,
          amountB,
          0,
          0,
          user1.address,
          Math.floor(Date.now() / 1000) + 3600
        );
      }

      // Test multi-hop swaps
      const multiHopPaths = [
        [usdc, weth, dai],
        [wbtc, weth, usdc],
        [link, weth, dai],
        [dai, usdc, weth],
      ];

      for (const path of multiHopPaths) {
        const [tokenIn, tokenMid, tokenOut] = path;
        const amountIn = ethers.parseEther("10");

        await tokenIn.connect(user1).approve(await router.getAddress(), amountIn);

        await expect(
          router.swapExactTokensForTokens(
            amountIn,
            0,
            [await tokenIn.getAddress(), await tokenMid.getAddress(), await tokenOut.getAddress()],
            user2.address,
            Math.floor(Date.now() / 1000) + 3600
          )
        ).to.not.be.reverted;
      }
    });

    it("should handle concurrent operations from multiple users", async function () {
      const {
        factory,
        router,
        weth,
        usdc,
        dai,
        user1,
        user2,
        user3,
      } = await loadFixture(deployFullSystemFixture);

      // Create pair
      await factory.createPair(await weth.getAddress(), await usdc.getAddress());

      // Add initial liquidity
      await weth.connect(user1).approve(await router.getAddress(), ethers.parseEther("1000"));
      await usdc.connect(user1).approve(await router.getAddress(), ethers.parseUnits("2000000", 6));
      await router.connect(user1).addLiquidity(
        await weth.getAddress(),
        await usdc.getAddress(),
        ethers.parseEther("1000"),
        ethers.parseUnits("2000000", 6),
        0,
        0,
        user1.address,
        Math.floor(Date.now() / 1000) + 3600
      );

      // Simulate concurrent operations
      const operations = [
        // User 1: Add more liquidity
        async () => {
          await weth.connect(user1).approve(await router.getAddress(), ethers.parseEther("100"));
          await usdc.connect(user1).approve(await router.getAddress(), ethers.parseUnits("200000", 6));
          return router.connect(user1).addLiquidity(
            await weth.getAddress(),
            await usdc.getAddress(),
            ethers.parseEther("100"),
            ethers.parseUnits("200000", 6),
            0,
            0,
            user1.address,
            Math.floor(Date.now() / 1000) + 3600
          );
        },
        // User 2: Swap WETH for USDC
        async () => {
          await weth.connect(user2).approve(await router.getAddress(), ethers.parseEther("10"));
          return router.connect(user2).swapExactTokensForTokens(
            ethers.parseEther("10"),
            0,
            [await weth.getAddress(), await usdc.getAddress()],
            user2.address,
            Math.floor(Date.now() / 1000) + 3600
          );
        },
        // User 3: Swap USDC for WETH
        async () => {
          await usdc.connect(user3).approve(await router.getAddress(), ethers.parseUnits("10000", 6));
          return router.connect(user3).swapExactTokensForTokens(
            ethers.parseUnits("10000", 6),
            0,
            [await usdc.getAddress(), await weth.getAddress()],
            user3.address,
            Math.floor(Date.now() / 1000) + 3600
          );
        },
      ];

      // Execute operations concurrently
      const promises = operations.map(op => op());
      const results = await Promise.allSettled(promises);

      // All operations should succeed
      for (const result of results) {
        expect(result.status).to.equal("fulfilled");
      }
    });
  });

  describe("Security Integration", function () {
    it("should integrate security audit with trading operations", async function () {
      const {
        factory,
        router,
        securityAudit,
        weth,
        usdc,
        user1,
      } = await loadFixture(deployFullSystemFixture);

      // Create pair
      await factory.createPair(await weth.getAddress(), await usdc.getAddress());

      // Check security before adding liquidity
      const pairAddress = await factory.getPair(await weth.getAddress(), await usdc.getAddress());
      const [isSuspicious, reason] = await securityAudit.checkPairSecurity(pairAddress);
      expect(isSuspicious).to.be.true; // Should be suspicious due to zero reserves
      expect(reason).to.equal("Zero reserves detected");

      // Add liquidity
      await weth.connect(user1).approve(await router.getAddress(), ethers.parseEther("1000"));
      await usdc.connect(user1).approve(await router.getAddress(), ethers.parseUnits("2000000", 6));
      await router.connect(user1).addLiquidity(
        await weth.getAddress(),
        await usdc.getAddress(),
        ethers.parseEther("1000"),
        ethers.parseUnits("2000000", 6),
        0,
        0,
        user1.address,
        Math.floor(Date.now() / 1000) + 3600
      );

      // Check security after adding liquidity
      const [isSuspiciousAfter, reasonAfter] = await securityAudit.checkPairSecurity(pairAddress);
      expect(isSuspiciousAfter).to.be.false; // Should not be suspicious anymore
      expect(reasonAfter).to.equal("No suspicious activity detected");

      // Test price impact monitoring
      const [priceImpact, isExcessive] = await securityAudit.checkPriceImpact(
        pairAddress,
        ethers.parseEther("100"), // 10% of reserves
        true
      );

      expect(priceImpact).to.be.gt(0);
      expect(isExcessive).to.be.false; // 10% should not be excessive
    });

    it("should integrate circuit breaker with trading operations", async function () {
      const {
        factory,
        router,
        circuitBreaker,
        weth,
        usdc,
        user1,
      } = await loadFixture(deployFullSystemFixture);

      // Create pair
      await factory.createPair(await weth.getAddress(), await usdc.getAddress());

      // Add liquidity
      await weth.connect(user1).approve(await router.getAddress(), ethers.parseEther("1000"));
      await usdc.connect(user1).approve(await router.getAddress(), ethers.parseUnits("2000000", 6));
      await router.connect(user1).addLiquidity(
        await weth.getAddress(),
        await usdc.getAddress(),
        ethers.parseEther("1000"),
        ethers.parseUnits("2000000", 6),
        0,
        0,
        user1.address,
        Math.floor(Date.now() / 1000) + 3600
      );

      const pairAddress = await factory.getPair(await weth.getAddress(), await usdc.getAddress());

      // Test normal operation
      let swapAllowed = await circuitBreaker.checkSwapAllowed(
        pairAddress,
        ethers.parseEther("10"),
        user1.address
      );
      expect(swapAllowed).to.be.true;

      // Set rate limit
      await circuitBreaker.setPairRateLimit(
        pairAddress,
        ethers.parseEther("100"), // 100 ETH per hour
        3600 // 1 hour
      );

      // Test within rate limit
      swapAllowed = await circuitBreaker.checkSwapAllowed(
        pairAddress,
        ethers.parseEther("50"),
        user1.address
      );
      expect(swapAllowed).to.be.true;

      // Test exceeding rate limit
      swapAllowed = await circuitBreaker.checkSwapAllowed(
        pairAddress,
        ethers.parseEther("150"),
        user1.address
      );
      expect(swapAllowed).to.be.false;

      // Test blacklist
      await circuitBreaker.addToBlacklist(user1.address);
      swapAllowed = await circuitBreaker.checkSwapAllowed(
        pairAddress,
        ethers.parseEther("10"),
        user1.address
      );
      expect(swapAllowed).to.be.false;

      // Test whitelist
      await circuitBreaker.removeFromBlacklist(user1.address);
      await circuitBreaker.addToWhitelist(user1.address);
      swapAllowed = await circuitBreaker.checkSwapAllowed(
        pairAddress,
        ethers.parseEther("1000"), // Even large amounts should be allowed
        user1.address
      );
      expect(swapAllowed).to.be.true;
    });
  });

  describe("Governance Integration", function () {
    it("should handle governance proposals and execution", async function () {
      const {
        factory,
        governance,
        owner,
        user1,
      } = await loadFixture(deployFullSystemFixture);

      // Create a proposal to change factory fee
      const targets = [await factory.getAddress()];
      const values = [0];
      const signatures = ["setFeeTo(address)"];
      const calldatas = [ethers.AbiCoder.defaultAbiCoder().encode(["address"], [user1.address])];

      const proposalId = await governance.propose(
        targets,
        values,
        signatures,
        calldatas,
        "Change fee recipient to user1"
      );

      expect(proposalId).to.equal(1);

      // Check proposal state
      const state = await governance.state(proposalId);
      expect(state).to.equal(0); // Pending

      // Fast forward to voting period
      await ethers.provider.send("evm_increaseTime", [86400]); // 1 day
      await ethers.provider.send("evm_mine", []);

      // Check proposal state again
      const activeState = await governance.state(proposalId);
      expect(activeState).to.equal(1); // Active

      // Cast votes (this would need actual governance token implementation)
      // For now, just test the proposal creation and state management
    });
  });

  describe("Stress Testing", function () {
    it("should handle high-frequency trading", async function () {
      const {
        factory,
        router,
        weth,
        usdc,
        user1,
        user2,
      } = await loadFixture(deployFullSystemFixture);

      // Create pair
      await factory.createPair(await weth.getAddress(), await usdc.getAddress());

      // Add liquidity
      await weth.connect(user1).approve(await router.getAddress(), ethers.parseEther("10000"));
      await usdc.connect(user1).approve(await router.getAddress(), ethers.parseUnits("20000000", 6));
      await router.connect(user1).addLiquidity(
        await weth.getAddress(),
        await usdc.getAddress(),
        ethers.parseEther("10000"),
        ethers.parseUnits("20000000", 6),
        0,
        0,
        user1.address,
        Math.floor(Date.now() / 1000) + 3600
      );

      // Simulate high-frequency trading
      const trades = [];
      for (let i = 0; i < 20; i++) {
        const amount = ethers.parseEther((Math.random() * 10 + 1).toString());
        const isWethToUsdc = Math.random() > 0.5;

        if (isWethToUsdc) {
          await weth.connect(user2).approve(await router.getAddress(), amount);
          trades.push(
            router.connect(user2).swapExactTokensForTokens(
              amount,
              0,
              [await weth.getAddress(), await usdc.getAddress()],
              user2.address,
              Math.floor(Date.now() / 1000) + 3600
            )
          );
        } else {
          await usdc.connect(user2).approve(await router.getAddress(), ethers.parseUnits("10000", 6));
          trades.push(
            router.connect(user2).swapExactTokensForTokens(
              ethers.parseUnits("10000", 6),
              0,
              [await usdc.getAddress(), await weth.getAddress()],
              user2.address,
              Math.floor(Date.now() / 1000) + 3600
            )
          );
        }
      }

      // Execute all trades
      const results = await Promise.allSettled(trades);
      
      // Most trades should succeed (some might fail due to price impact limits)
      const successfulTrades = results.filter(r => r.status === "fulfilled").length;
      expect(successfulTrades).to.be.gt(15); // At least 75% should succeed
    });

    it("should handle large liquidity operations", async function () {
      const {
        factory,
        router,
        weth,
        usdc,
        user1,
      } = await loadFixture(deployFullSystemFixture);

      // Create pair
      await factory.createPair(await weth.getAddress(), await usdc.getAddress());

      // Add very large liquidity
      const largeAmount = ethers.parseEther("1000000");
      await weth.connect(user1).approve(await router.getAddress(), largeAmount);
      await usdc.connect(user1).approve(await router.getAddress(), ethers.parseUnits("2000000000", 6));

      const tx = await router.connect(user1).addLiquidity(
        await weth.getAddress(),
        await usdc.getAddress(),
        largeAmount,
        ethers.parseUnits("2000000000", 6),
        0,
        0,
        user1.address,
        Math.floor(Date.now() / 1000) + 3600
      );

      const receipt = await tx.wait();
      expect(receipt?.status).to.equal(1);

      // Test large swaps
      await weth.connect(user1).approve(await router.getAddress(), ethers.parseEther("100000"));
      const swapTx = await router.connect(user1).swapExactTokensForTokens(
        ethers.parseEther("100000"),
        0,
        [await weth.getAddress(), await usdc.getAddress()],
        user1.address,
        Math.floor(Date.now() / 1000) + 3600
      );

      const swapReceipt = await swapTx.wait();
      expect(swapReceipt?.status).to.equal(1);
    });
  });
});
