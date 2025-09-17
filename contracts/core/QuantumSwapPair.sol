// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "../tokens/ERC20.sol";
import {IERC20} from "../../interfaces/IERC20.sol";
import {IQuantumSwapPair} from "../../interfaces/IQuantumSwapPair.sol";
import {IQuantumSwapFactory} from "../../interfaces/IQuantumSwapFactory.sol";
import {Math} from "../libs/Math.sol";
import {UQ112x112} from "../libs/UQ112x112.sol";

/// @dev Callback interface for flash swaps. Optional for receivers.
interface IQuantumSwapCallee {
    function quantumSwapCall(address sender, uint256 amount0, uint256 amount1, bytes calldata data) external;
}

/// @title QuantumSwap Pair
/// @notice AMM pair contract that manages a constant-product pool and issues LP tokens.
/// @dev Largely based on Uniswap V2 Pair mechanics with gas-conscious style.
contract QuantumSwapPair is ERC20, IQuantumSwapPair {
    using UQ112x112 for UQ112x112.UQ;

    /// @notice Address of the factory that deployed this pair
    address public immutable factory;

    /// @dev Burn address to permanently lock initial liquidity
    address private constant BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    /// @inheritdoc IQuantumSwapPair
    address public token0;

    /// @inheritdoc IQuantumSwapPair
    address public token1;

    // Reserves, packed for gas efficiency
    uint112 private reserve0; // uses single storage slot with the next two vars
    uint112 private reserve1;
    uint32 private blockTimestampLast;

    /// @inheritdoc IQuantumSwapPair
    uint256 public price0CumulativeLast;

    /// @inheritdoc IQuantumSwapPair
    uint256 public price1CumulativeLast;

    /// @inheritdoc IQuantumSwapPair
    uint256 public kLast; // reserve0 * reserve1, last update

    uint256 private constant MINIMUM_LIQUIDITY = 1000;

    uint256 private unlocked = 1;
    modifier lock() {
        require(unlocked == 1, "PAIR: LOCKED");
        unlocked = 0;
        _;
        unlocked = 1;
    }

    constructor() ERC20("QuantumSwap LP", "QSLP", 18) {
        factory = msg.sender;
    }

    /// @inheritdoc IQuantumSwapPair
    function getReserves()
        public
        view
        override
        returns (
            uint112 _reserve0,
            uint112 _reserve1,
            uint32 _blockTimestampLast
        )
    {
        _reserve0 = reserve0;
        _reserve1 = reserve1;
        _blockTimestampLast = blockTimestampLast;
    }

    function _currentBlockTimestamp() private view returns (uint32) {
        return uint32(block.timestamp);
    }

    /// @dev Internal: mint protocol fee to feeTo if enabled and k grew.
    function _mintFee(uint112 _reserve0, uint112 _reserve1) private returns (bool feeOn) {
        address feeTo = IQuantumSwapFactory(factory).feeTo();
        feeOn = feeTo != address(0);
        uint256 _kLast = kLast;
        if (feeOn) {
            if (_kLast != 0) {
                uint256 rootK = Math.sqrt(uint256(_reserve0) * uint256(_reserve1));
                uint256 rootKLast = Math.sqrt(_kLast);
                if (rootK > rootKLast) {
                    uint256 numerator = totalSupply * (rootK - rootKLast);
                    uint256 denominator = (rootK * 5) + rootKLast;
                    uint256 liquidity = numerator / denominator;
                    if (liquidity > 0) _mint(feeTo, liquidity);
                }
            }
        } else if (_kLast != 0) {
            kLast = 0;
        }
    }

    /// @dev Update reserves and, on the first call per block, price accumulators.
    function _update(uint256 balance0, uint256 balance1, uint112 _reserve0, uint112 _reserve1) private {
        require(balance0 <= type(uint112).max && balance1 <= type(uint112).max, "PAIR: OVERFLOW");
        uint32 blockTimestamp = _currentBlockTimestamp();
        uint32 timeElapsed = blockTimestamp - blockTimestampLast; // overflow is desired
        
        // Oracle manipulation protection: Cap timeElapsed to prevent extreme price manipulation
        // Maximum 1 hour (3600 seconds) between updates to prevent oracle attacks
        if (timeElapsed > 3600) {
            timeElapsed = 3600;
        }
        
        if (timeElapsed > 0 && _reserve0 != 0 && _reserve1 != 0) {
            // Additional protection: Check for extreme price changes
            uint256 currentPrice0 = uint256(UQ112x112.encode(_reserve1).uqdiv(_reserve0).q);
            uint256 currentPrice1 = uint256(UQ112x112.encode(_reserve0).uqdiv(_reserve1).q);
            
            // Only update if reserves have changed significantly (minimum 0.1% change)
            uint256 reserve0Change = balance0 > _reserve0 ? 
                ((balance0 - _reserve0) * 1000) / _reserve0 : 
                ((_reserve0 - balance0) * 1000) / _reserve0;
            uint256 reserve1Change = balance1 > _reserve1 ? 
                ((balance1 - _reserve1) * 1000) / _reserve1 : 
                ((_reserve1 - balance1) * 1000) / _reserve1;
            
            // Update price accumulators only if there's meaningful change
            if (reserve0Change >= 1 || reserve1Change >= 1) {
                price0CumulativeLast += currentPrice0 * timeElapsed;
                price1CumulativeLast += currentPrice1 * timeElapsed;
            }
        }
        reserve0 = uint112(balance0);
        reserve1 = uint112(balance1);
        blockTimestampLast = blockTimestamp;
        emit Sync(reserve0, reserve1);
    }

    /// @inheritdoc IQuantumSwapPair
    function mint(address to) external override lock returns (uint256 liquidity) {
        (uint112 _reserve0, uint112 _reserve1, ) = getReserves();
        uint256 balance0 = IERC20(token0).balanceOf(address(this));
        uint256 balance1 = IERC20(token1).balanceOf(address(this));
        uint256 amount0 = balance0 - _reserve0;
        uint256 amount1 = balance1 - _reserve1;

        bool feeOn = _mintFee(_reserve0, _reserve1);
        uint256 _totalSupply = totalSupply; // gas save
        if (_totalSupply == 0) {
            liquidity = Math.sqrt(amount0 * amount1) - MINIMUM_LIQUIDITY;
            _mint(BURN_ADDRESS, MINIMUM_LIQUIDITY); // permanently lock
        } else {
            liquidity = Math.min((amount0 * _totalSupply) / _reserve0, (amount1 * _totalSupply) / _reserve1);
        }
        require(liquidity > 0, "PAIR: INSUFFICIENT_LIQUIDITY_MINTED");
        _mint(to, liquidity);

        _update(balance0, balance1, _reserve0, _reserve1);
        if (feeOn) kLast = uint256(reserve0) * uint256(reserve1);

        emit Mint(msg.sender, amount0, amount1);
    }

    /// @inheritdoc IQuantumSwapPair
    function burn(address to) external override lock returns (uint256 amount0, uint256 amount1) {
        (uint112 _reserve0, uint112 _reserve1, ) = getReserves();
        address _token0 = token0; // gas
        address _token1 = token1;
        uint256 balance0 = IERC20(_token0).balanceOf(address(this));
        uint256 balance1 = IERC20(_token1).balanceOf(address(this));
        uint256 liquidity = balanceOf[address(this)];

        bool feeOn = _mintFee(_reserve0, _reserve1);
        uint256 _totalSupply = totalSupply; // gas save
        require(_totalSupply != 0, "PAIR: NO_SUPPLY");
        amount0 = (liquidity * balance0) / _totalSupply; // using balances ensures pro-rata distribution
        amount1 = (liquidity * balance1) / _totalSupply; // using balances ensures pro-rata distribution
        require(amount0 > 0 && amount1 > 0, "PAIR: INSUFFICIENT_LIQUIDITY_BURNED");
        _burn(address(this), liquidity);
        require(IERC20(_token0).transfer(to, amount0), "PAIR: TRANSFER0_FAILED");
        require(IERC20(_token1).transfer(to, amount1), "PAIR: TRANSFER1_FAILED");
        balance0 = IERC20(_token0).balanceOf(address(this));
        balance1 = IERC20(_token1).balanceOf(address(this));

        _update(balance0, balance1, _reserve0, _reserve1);
        if (feeOn) kLast = uint256(reserve0) * uint256(reserve1);

        emit Burn(msg.sender, amount0, amount1, to);
    }

    /// @inheritdoc IQuantumSwapPair
    function swap(uint256 amount0Out, uint256 amount1Out, address to, bytes calldata data) external override lock {
        require(amount0Out > 0 || amount1Out > 0, "PAIR: INSUFFICIENT_OUTPUT");
        (uint112 _reserve0, uint112 _reserve1, ) = getReserves();
        require(amount0Out < _reserve0 && amount1Out < _reserve1, "PAIR: INSUFFICIENT_LIQUIDITY");
        require(to != token0 && to != token1, "PAIR: INVALID_TO");

        // MEV Protection: Check for suspiciously large swaps (>50% of reserves)
        require(amount0Out <= (_reserve0 * 5000) / 10000 && amount1Out <= (_reserve1 * 5000) / 10000, "PAIR: SWAP_TOO_LARGE");

        // MEV Protection: Minimum swap amount to prevent dust attacks
        require(amount0Out >= 1000 || amount1Out >= 1000, "PAIR: SWAP_TOO_SMALL");

        if (amount0Out > 0) require(IERC20(token0).transfer(to, amount0Out), "PAIR: TO0_FAIL");
        if (amount1Out > 0) require(IERC20(token1).transfer(to, amount1Out), "PAIR: TO1_FAIL");
        if (data.length > 0) IQuantumSwapCallee(to).quantumSwapCall(msg.sender, amount0Out, amount1Out, data);

        uint256 balance0 = IERC20(token0).balanceOf(address(this));
        uint256 balance1 = IERC20(token1).balanceOf(address(this));

        uint256 amount0In = balance0 > (uint256(_reserve0) - amount0Out) ? balance0 - (uint256(_reserve0) - amount0Out) : 0;
        uint256 amount1In = balance1 > (uint256(_reserve1) - amount1Out) ? balance1 - (uint256(_reserve1) - amount1Out) : 0;
        require(amount0In > 0 || amount1In > 0, "PAIR: INSUFFICIENT_INPUT");

        // MEV Protection: Check for extreme price impact (>20%)
        require((amount0In == 0 || (amount0In * 10000) / _reserve0 <= 2000) && 
                (amount1In == 0 || (amount1In * 10000) / _reserve1 <= 2000), "PAIR: PRICE_IMPACT_TOO_HIGH");

        // Adjusted balances to account for 0.3% swap fee
        require(
            ((balance0 * 1000) - (amount0In * 3)) * ((balance1 * 1000) - (amount1In * 3)) >=
                uint256(_reserve0) * uint256(_reserve1) * 1_000_000,
            "PAIR: K"
        );

        _update(balance0, balance1, _reserve0, _reserve1);
        emit Swap(msg.sender, amount0In, amount1In, amount0Out, amount1Out, to);
    }

    /// @inheritdoc IQuantumSwapPair
    function skim(address to) external override lock {
        address _token0 = token0;
        address _token1 = token1;
        (uint112 _reserve0, uint112 _reserve1, ) = getReserves();
        require(IERC20(_token0).transfer(to, IERC20(_token0).balanceOf(address(this)) - _reserve0), "PAIR: SKIM0_FAIL");
        require(IERC20(_token1).transfer(to, IERC20(_token1).balanceOf(address(this)) - _reserve1), "PAIR: SKIM1_FAIL");
    }

    /// @inheritdoc IQuantumSwapPair
    function sync() external override lock {
        _update(
            IERC20(token0).balanceOf(address(this)),
            IERC20(token1).balanceOf(address(this)),
            reserve0,
            reserve1
        );
    }

    /// @inheritdoc IQuantumSwapPair
    function initialize(address _token0, address _token1) external override {
        require(msg.sender == factory, "PAIR: FORBIDDEN");
        require(token0 == address(0) && token1 == address(0), "PAIR: ALREADY_INIT");
        token0 = _token0;
        token1 = _token1;
    }
}



