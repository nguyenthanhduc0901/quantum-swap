// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "./IERC20.sol";

/// @title QuantumSwap Pair Interface (LP Token + Pool)
/// @notice Defines the external interface for a QuantumSwap liquidity pair, which also acts as an ERC20 LP token.
/// @dev The pair tracks reserves of `token0` and `token1`, supports mint/burn/swap, and exposes TWAP accumulators.
interface IQuantumSwapPair is IERC20 {
    /// @notice Emitted when liquidity is minted to the pool.
    /// @param sender The address that provided liquidity
    /// @param amount0 The amount of token0 added
    /// @param amount1 The amount of token1 added
    event Mint(address indexed sender, uint256 amount0, uint256 amount1);

    /// @notice Emitted when liquidity is burned from the pool.
    /// @param sender The address that burned LP tokens
    /// @param amount0 The amount of token0 removed
    /// @param amount1 The amount of token1 removed
    /// @param to The recipient of withdrawn tokens
    event Burn(address indexed sender, uint256 amount0, uint256 amount1, address indexed to);

    /// @notice Emitted when a swap occurs.
    /// @param sender The address that initiated the swap
    /// @param amount0In The amount of token0 sent in
    /// @param amount1In The amount of token1 sent in
    /// @param amount0Out The amount of token0 sent out
    /// @param amount1Out The amount of token1 sent out
    /// @param to The recipient of the output tokens
    event Swap(
        address indexed sender,
        uint256 amount0In,
        uint256 amount1In,
        uint256 amount0Out,
        uint256 amount1Out,
        address indexed to
    );

    /// @notice Emitted when reserves are updated.
    /// @param reserve0 New reserve of token0
    /// @param reserve1 New reserve of token1
    event Sync(uint112 reserve0, uint112 reserve1);

    /// @notice Returns the factory that deployed this pair.
    /// @return factoryAddress The factory contract address
    function factory() external view returns (address factoryAddress);

    /// @notice Returns the address of token0 for this pair.
    /// @return token0Address The token0 address
    function token0() external view returns (address token0Address);

    /// @notice Returns the address of token1 for this pair.
    /// @return token1Address The token1 address
    function token1() external view returns (address token1Address);

    /// @notice Returns the current reserves of the pair and the timestamp of the last block the reserves were updated.
    /// @dev Reserve values are stored as uint112 for gas efficiency and to prevent overflows.
    /// @return _reserve0 The current reserve of token0
    /// @return _reserve1 The current reserve of token1
    /// @return _blockTimestampLast The last block timestamp when reserves were updated
    function getReserves()
        external
        view
        returns (
            uint112 _reserve0,
            uint112 _reserve1,
            uint32 _blockTimestampLast
        );

    /// @notice The cumulative price of token0, used for time-weighted average price (TWAP) calculations.
    /// @return price0Cumulative The last recorded cumulative price for token0
    function price0CumulativeLast() external view returns (uint256 price0Cumulative);

    /// @notice The cumulative price of token1, used for time-weighted average price (TWAP) calculations.
    /// @return price1Cumulative The last recorded cumulative price for token1
    function price1CumulativeLast() external view returns (uint256 price1Cumulative);

    /// @notice The product of the reserves, `k = reserve0 * reserve1`, after the most recent liquidity event.
    /// @return lastK The last recorded reserves product
    function kLast() external view returns (uint256 lastK);

    /// @notice Mints LP tokens to `to` by adding liquidity to the pool.
    /// @dev Must be called after transferring the owed token balances to the pair.
    /// @param to The recipient address of the minted LP tokens
    /// @return liquidity The amount of LP tokens minted
    function mint(address to) external returns (uint256 liquidity);

    /// @notice Burns LP tokens and returns the underlying tokens to `to`.
    /// @param to The recipient of the withdrawn token amounts
    /// @return amount0 The amount of token0 returned
    /// @return amount1 The amount of token1 returned
    function burn(address to) external returns (uint256 amount0, uint256 amount1);

    /// @notice Executes a swap from one token to the other, sending output to `to`.
    /// @dev Either `amount0Out` or `amount1Out` must be non-zero. Allows flash swap callbacks via `data`.
    /// @param amount0Out The amount of token0 to send out
    /// @param amount1Out The amount of token1 to send out
    /// @param to The recipient of output tokens
    /// @param data Arbitrary data forwarded to the `to`'s callback for flash swaps
    function swap(uint256 amount0Out, uint256 amount1Out, address to, bytes calldata data) external;

    /// @notice Sends to `to` any token balances that exceed the stored reserves.
    /// @param to The address to receive excess tokens
    function skim(address to) external;

    /// @notice Updates the stored reserves to match the current token balances.
    function sync() external;

    /// @notice Initializes the pair with `token0` and `token1`. Can only be called once, by the factory.
    /// @param _token0 The token0 address
    /// @param _token1 The token1 address
    function initialize(address _token0, address _token1) external;
}



