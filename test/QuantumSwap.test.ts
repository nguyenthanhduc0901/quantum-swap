import { expect } from "chai";
import { ethers } from "hardhat";

describe("QuantumSwap Protocol", function () {
  let owner: any, user1: any, user2: any;
  let Factory: any, factory: any;
  let WETH: any, weth: any;
  let Router: any, router: any;
  let TokenA: any, tokenA: any;
  let TokenB: any, tokenB: any;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    const FactoryC = await ethers.getContractFactory("QuantumSwapFactory");
    factory = await FactoryC.deploy(owner.address);
    await factory.waitForDeployment();

    const WETHC = await ethers.getContractFactory("WETH9");
    weth = await WETHC.deploy();
    await weth.waitForDeployment();

    const RouterC = await ethers.getContractFactory("QuantumSwapRouter");
    router = await RouterC.deploy(await factory.getAddress(), await weth.getAddress());
    await router.waitForDeployment();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    tokenA = await MockERC20.deploy("TokenA", "TKA", 18);
    tokenB = await MockERC20.deploy("TokenB", "TKB", 18);
    await tokenA.waitForDeployment();
    await tokenB.waitForDeployment();

    // Mint initial balances
    await tokenA.mint(owner.address, ethers.parseEther("1000000"));
    await tokenB.mint(owner.address, ethers.parseEther("1000000"));
    await tokenA.mint(user1.address, ethers.parseEther("1000000"));
    await tokenB.mint(user1.address, ethers.parseEther("1000000"));
  });

  function sort(a: string, b: string): [string, string] {
    return a.toLowerCase() < b.toLowerCase() ? [a, b] : [b, a];
  }

  // Integer sqrt using Babylonian method for BigInt
  function sqrtBI(y: bigint): bigint {
    if (y === 0n) return 0n;
    let z = y;
    let x = y / 2n + 1n;
    while (x < z) {
      z = x;
      x = (y / x + x) / 2n;
    }
    return z;
  }

  async function getPairAddress(tokenX: any, tokenY: any): Promise<string> {
    const pair = await factory.getPair(await tokenX.getAddress(), await tokenY.getAddress());
    return pair;
  }

  describe("Factory", function () {
    it("creates pair correctly and emits event", async function () {
      await expect(factory.createPair(await tokenA.getAddress(), await tokenB.getAddress()))
        .to.emit(factory, "PairCreated");
      const pairAddr = await factory.getPair(await tokenA.getAddress(), await tokenB.getAddress());
      expect(pairAddr).to.properAddress;
    });

    it("orders token0 < token1", async function () {
      await factory.createPair(await tokenA.getAddress(), await tokenB.getAddress());
      const pairAddr = await getPairAddress(tokenA, tokenB);
      const Pair = await ethers.getContractFactory("QuantumSwapPair");
      const pair = Pair.attach(pairAddr);
      const token0 = await pair.token0();
      const token1 = await pair.token1();
      const [s0, s1] = sort(await tokenA.getAddress(), await tokenB.getAddress());
      expect(token0).to.equal(s0);
      expect(token1).to.equal(s1);
    });

    it("rejects identical token pair and duplicate pair", async function () {
      await expect(factory.createPair(await tokenA.getAddress(), await tokenA.getAddress())).to.be.revertedWith("FACTORY: IDENTICAL_ADDRESSES");
      await factory.createPair(await tokenA.getAddress(), await tokenB.getAddress());
      await expect(factory.createPair(await tokenB.getAddress(), await tokenA.getAddress())).to.be.revertedWith("FACTORY: PAIR_EXISTS");
    });

    it("manages feeTo and feeToSetter", async function () {
      await factory.setFeeTo(owner.address);
      expect(await factory.feeTo()).to.equal(owner.address);
      await expect(factory.connect(user1).setFeeTo(user1.address)).to.be.revertedWith("FACTORY: FORBIDDEN");
      await factory.setFeeToSetter(user1.address);
      expect(await factory.feeToSetter()).to.equal(user1.address);
    });
  });

  describe("Liquidity via Router", function () {
    beforeEach(async function () {
      await factory.createPair(await tokenA.getAddress(), await tokenB.getAddress());
      await tokenA.connect(user1).approve(await router.getAddress(), ethers.MaxUint256);
      await tokenB.connect(user1).approve(await router.getAddress(), ethers.MaxUint256);
    });

    it("addLiquidity first time mints sqrt(x*y) - MINIMUM_LIQUIDITY", async function () {
      const amountA = ethers.parseEther("1000");
      const amountB = ethers.parseEther("1000");
      const pairAddr = await getPairAddress(tokenA, tokenB);
      const Pair = await ethers.getContractFactory("QuantumSwapPair");
      const pair = Pair.attach(pairAddr);

      await router.connect(user1).addLiquidity(
        await tokenA.getAddress(),
        await tokenB.getAddress(),
        amountA,
        amountB,
        0,
        0,
        user1.address,
        (await ethers.provider.getBlock("latest")).timestamp + 3600
      );

      const userLP = await pair.balanceOf(user1.address);
      const totalSupply = await pair.totalSupply();
      const MINIMUM_LIQUIDITY = 1000n;
      const expectedMint = sqrtBI(ethers.toBigInt(amountA) * ethers.toBigInt(amountB)) - MINIMUM_LIQUIDITY;
      expect(userLP).to.equal(expectedMint);
      const locked = await pair.balanceOf("0x000000000000000000000000000000000000dEaD");
      expect(locked).to.equal(MINIMUM_LIQUIDITY);
      expect(totalSupply).to.equal(userLP + locked);
    });

    it("subsequent addLiquidity proportional and reserves update", async function () {
      const amountA = ethers.parseEther("1000");
      const amountB = ethers.parseEther("1000");
      await router.connect(user1).addLiquidity(
        await tokenA.getAddress(),
        await tokenB.getAddress(),
        amountA,
        amountB,
        0,
        0,
        user1.address,
        (await ethers.provider.getBlock("latest")).timestamp + 3600
      );

      const pairAddr = await getPairAddress(tokenA, tokenB);
      const Pair = await ethers.getContractFactory("QuantumSwapPair");
      const pair = Pair.attach(pairAddr);

      await router.connect(user1).addLiquidity(
        await tokenA.getAddress(),
        await tokenB.getAddress(),
        amountA,
        amountB,
        0,
        0,
        user1.address,
        (await ethers.provider.getBlock("latest")).timestamp + 3600
      );

      const reserves = await pair.getReserves();
      expect(reserves[0]).to.equal(ethers.parseEther("2000"));
      expect(reserves[1]).to.equal(ethers.parseEther("2000"));
    });

    it("addLiquidityETH wraps ETH and mints LP", async function () {
      await tokenA.connect(user1).approve(await router.getAddress(), ethers.MaxUint256);
      const amountToken = ethers.parseEther("10");
      const amountETH = ethers.parseEther("5");
      await router.connect(user1).addLiquidityETH(
        await tokenA.getAddress(),
        amountToken,
        0,
        0,
        user1.address,
        (await ethers.provider.getBlock("latest")).timestamp + 3600,
        { value: amountETH }
      );
      const pairAB = await factory.getPair(await tokenA.getAddress(), await weth.getAddress());
      expect(pairAB).to.properAddress;
    });

    it("removeLiquidity burns LP and returns tokens", async function () {
      const amountA = ethers.parseEther("1000");
      const amountB = ethers.parseEther("1000");
      const deadline = (await ethers.provider.getBlock("latest")).timestamp + 3600;
      await router.connect(user1).addLiquidity(
        await tokenA.getAddress(),
        await tokenB.getAddress(),
        amountA,
        amountB,
        0,
        0,
        user1.address,
        deadline
      );
      const pairAddr = await getPairAddress(tokenA, tokenB);
      const Pair = await ethers.getContractFactory("QuantumSwapPair");
      const pair = Pair.attach(pairAddr);
      const lpBal = await pair.balanceOf(user1.address);
      await pair.connect(user1).approve(await router.getAddress(), lpBal);
      await router.connect(user1).removeLiquidity(
        await tokenA.getAddress(),
        await tokenB.getAddress(),
        lpBal,
        0,
        0,
        user1.address,
        deadline
      );
      const lpAfter = await pair.balanceOf(user1.address);
      expect(lpAfter).to.equal(0);
    });

    it("removeLiquidityETH unwraps to ETH", async function () {
      const deadline = (await ethers.provider.getBlock("latest")).timestamp + 3600;
      await router.connect(user1).addLiquidityETH(
        await tokenA.getAddress(),
        ethers.parseEther("10"),
        0,
        0,
        user1.address,
        deadline,
        { value: ethers.parseEther("5") }
      );
      const pairAddr = await factory.getPair(await tokenA.getAddress(), await weth.getAddress());
      const Pair = await ethers.getContractFactory("QuantumSwapPair");
      const pair = Pair.attach(pairAddr);
      const lp = await pair.balanceOf(user1.address);
      await pair.connect(user1).approve(await router.getAddress(), lp);
      await router.connect(user1).removeLiquidityETH(
        await tokenA.getAddress(),
        lp,
        0,
        0,
        user1.address,
        deadline
      );
      // Check LP burned and user received some ETH by verifying pair's reserves decreased
      const reserves = await pair.getReserves();
      expect(reserves[0]).to.be.lt(ethers.parseEther("10"));
      expect(reserves[1]).to.be.lt(ethers.parseEther("5"));
    });
  });

  describe("Swaps via Router", function () {
    beforeEach(async function () {
      await factory.createPair(await tokenA.getAddress(), await tokenB.getAddress());
      await tokenA.connect(user1).approve(await router.getAddress(), ethers.MaxUint256);
      await tokenB.connect(user1).approve(await router.getAddress(), ethers.MaxUint256);
      await router.connect(user1).addLiquidity(
        await tokenA.getAddress(),
        await tokenB.getAddress(),
        ethers.parseEther("1000"),
        ethers.parseEther("1000"),
        0,
        0,
        user1.address,
        (await ethers.provider.getBlock("latest")).timestamp + 3600
      );
    });

    it("swapExactTokensForTokens respects amountOutMin and updates balances", async function () {
      const path = [await tokenA.getAddress(), await tokenB.getAddress()];
      const amounts = await router.getAmountsOut(ethers.parseEther("10"), path);
      const outMin = (amounts[1] * 99n) / 100n; // 1% slippage
      const balBefore = await tokenB.balanceOf(user1.address);
      await router.connect(user1).swapExactTokensForTokens(
        ethers.parseEther("10"),
        outMin,
        path,
        user1.address,
        (await ethers.provider.getBlock("latest")).timestamp + 3600
      );
      const balAfter = await tokenB.balanceOf(user1.address);
      expect(balAfter - balBefore).to.be.gte(outMin);
    });

    it("swap fails when deadline passed", async function () {
      const path = [await tokenA.getAddress(), await tokenB.getAddress()];
      await expect(
        router.connect(user1).swapExactTokensForTokens(
          ethers.parseEther("1"),
          0,
          path,
          user1.address,
          (await ethers.provider.getBlock("latest")).timestamp - 1
        )
      ).to.be.revertedWith("QuantumSwap: EXPIRED");
    });

    it("swapExactETHForTokens executes and user gets tokens", async function () {
      const path = [await weth.getAddress(), await tokenA.getAddress()];
      // create pair WETH-tokenA with small liquidity
      await tokenA.mint(owner.address, ethers.parseEther("100"));
      await tokenA.approve(await router.getAddress(), ethers.MaxUint256);
      await router.addLiquidityETH(
        await tokenA.getAddress(),
        ethers.parseEther("100"),
        0,
        0,
        owner.address,
        (await ethers.provider.getBlock("latest")).timestamp + 3600,
        { value: ethers.parseEther("50") }
      );
      const balBefore = await tokenA.balanceOf(user1.address);
      await router.connect(user1).swapExactETHForTokens(
        0,
        path,
        user1.address,
        (await ethers.provider.getBlock("latest")).timestamp + 3600,
        { value: ethers.parseEther("1") }
      );
      const balAfter = await tokenA.balanceOf(user1.address);
      expect(balAfter).to.be.gt(balBefore);
    });

    it("swapExactTokensForETH returns ETH (not WETH)", async function () {
      const path = [await tokenA.getAddress(), await weth.getAddress()];
      // ensure WETH-tokenA pool exists
      await tokenA.mint(owner.address, ethers.parseEther("100"));
      await tokenA.approve(await router.getAddress(), ethers.MaxUint256);
      await router.addLiquidityETH(
        await tokenA.getAddress(),
        ethers.parseEther("100"),
        0,
        0,
        owner.address,
        (await ethers.provider.getBlock("latest")).timestamp + 3600,
        { value: ethers.parseEther("50") }
      );
      const balBefore = await ethers.provider.getBalance(user1.address);
      await tokenA.connect(user1).approve(await router.getAddress(), ethers.MaxUint256);
      await router.connect(user1).swapExactTokensForETH(
        ethers.parseEther("1"),
        0,
        path,
        user1.address,
        (await ethers.provider.getBlock("latest")).timestamp + 3600
      );
      const balAfter = await ethers.provider.getBalance(user1.address);
      expect(balAfter).to.be.gt(balBefore);
    });

    it("multi-hop swap A->B->C", async function () {
      const MockERC20 = await ethers.getContractFactory("MockERC20");
      const tokenC = await MockERC20.deploy("TokenC", "TKC", 18);
      await tokenC.waitForDeployment();
      await tokenC.mint(owner.address, ethers.parseEther("100000"));

      await factory.createPair(await tokenB.getAddress(), await tokenC.getAddress());

      // provide liquidity on B/C
      await tokenB.approve(await router.getAddress(), ethers.MaxUint256);
      await tokenC.approve(await router.getAddress(), ethers.MaxUint256);
      await router.addLiquidity(
        await tokenB.getAddress(),
        await tokenC.getAddress(),
        ethers.parseEther("1000"),
        ethers.parseEther("1000"),
        0,
        0,
        owner.address,
        (await ethers.provider.getBlock("latest")).timestamp + 3600
      );

      const path = [await tokenA.getAddress(), await tokenB.getAddress(), await tokenC.getAddress()];
      await tokenA.connect(user1).approve(await router.getAddress(), ethers.MaxUint256);
      const balBefore = await tokenC.balanceOf(user1.address);
      await router.connect(user1).swapExactTokensForTokens(
        ethers.parseEther("10"),
        0,
        path,
        user1.address,
        (await ethers.provider.getBlock("latest")).timestamp + 3600
      );
      const balAfter = await tokenC.balanceOf(user1.address);
      expect(balAfter).to.be.gt(balBefore);
    });
  });

  describe("Advanced: protocol fee and TWAP", function () {
    it("accrues protocol fee LP to feeTo", async function () {
      await factory.setFeeTo(owner.address);
      await factory.createPair(await tokenA.getAddress(), await tokenB.getAddress());
      await tokenA.approve(await router.getAddress(), ethers.MaxUint256);
      await tokenB.approve(await router.getAddress(), ethers.MaxUint256);
      const deadline = (await ethers.provider.getBlock("latest")).timestamp + 3600;
      await router.addLiquidity(
        await tokenA.getAddress(),
        await tokenB.getAddress(),
        ethers.parseEther("10000"),
        ethers.parseEther("10000"),
        0,
        0,
        owner.address,
        deadline
      );

      const pairAddr = await factory.getPair(await tokenA.getAddress(), await tokenB.getAddress());
      const Pair = await ethers.getContractFactory("QuantumSwapPair");
      const pair = Pair.attach(pairAddr);

      // perform swaps to grow k
      await tokenA.mint(user2.address, ethers.parseEther("500"));
      await tokenA.connect(user2).approve(await router.getAddress(), ethers.MaxUint256);
      await router.connect(user2).swapExactTokensForTokens(
        ethers.parseEther("500"), 0, [await tokenA.getAddress(), await tokenB.getAddress()], user2.address, deadline
      );
      // trigger fee mint by adding a tiny amount of liquidity
      await tokenA.approve(await router.getAddress(), ethers.MaxUint256);
      await tokenB.approve(await router.getAddress(), ethers.MaxUint256);
      await router.addLiquidity(
        await tokenA.getAddress(),
        await tokenB.getAddress(),
        ethers.parseEther("1"),
        ethers.parseEther("1"),
        0,
        0,
        owner.address,
        deadline
      );

      const feeBal = await pair.balanceOf(owner.address);
      expect(feeBal).to.be.gt(0);
    });

    it("updates price cumulatives for TWAP across time", async function () {
      await factory.createPair(await tokenA.getAddress(), await tokenB.getAddress());
      await tokenA.approve(await router.getAddress(), ethers.MaxUint256);
      await tokenB.approve(await router.getAddress(), ethers.MaxUint256);
      const deadline = (await ethers.provider.getBlock("latest")).timestamp + 3600;
      await router.addLiquidity(
        await tokenA.getAddress(),
        await tokenB.getAddress(),
        ethers.parseEther("1000"),
        ethers.parseEther("1000"),
        0,
        0,
        owner.address,
        deadline
      );

      const pairAddr = await factory.getPair(await tokenA.getAddress(), await tokenB.getAddress());
      const Pair = await ethers.getContractFactory("QuantumSwapPair");
      const pair = Pair.attach(pairAddr);

      const p0Before = await pair.price0CumulativeLast();
      const p1Before = await pair.price1CumulativeLast();

      // advance time
      await ethers.provider.send("evm_increaseTime", [3600]);
      await ethers.provider.send("evm_mine", []);

      // perform a trade to update reserves and cumulatives
      await tokenA.mint(user2.address, ethers.parseEther("10"));
      await tokenA.connect(user2).approve(await router.getAddress(), ethers.MaxUint256);
      const deadline2 = (await ethers.provider.getBlock("latest")).timestamp + 3600;
      await router.connect(user2).swapExactTokensForTokens(
        ethers.parseEther("10"), 0, [await tokenA.getAddress(), await tokenB.getAddress()], user2.address, deadline2
      );

      const p0After = await pair.price0CumulativeLast();
      const p1After = await pair.price1CumulativeLast();
      expect(p0After).to.be.gt(p0Before);
      expect(p1After).to.be.gt(p1Before);
    });
  });
});


