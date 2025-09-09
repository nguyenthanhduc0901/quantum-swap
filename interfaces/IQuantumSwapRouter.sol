// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title QuantumSwap Router Interface
/// @notice Peripheral contract interface for interacting with QuantumSwap pools.
interface IQuantumSwapRouter {
    /*//////////////////////////////////////////////////////////////
                        LIQUIDITY MANAGEMENT
    //////////////////////////////////////////////////////////////*/

    /// @notice Add liquidity for a token pair
    /// @param tokenA Address of token A
    /// @param tokenB Address of token B
    /// @param amountADesired Desired amount of token A to add
    /// @param amountBDesired Desired amount of token B to add
    /// @param amountAMin Minimum amount of token A to actually add
    /// @param amountBMin Minimum amount of token B to actually add
    /// @param to Recipient of the LP tokens
    /// @param deadline Unix timestamp after which the tx is invalid
    /// @return amountA Amount of token A added
    /// @return amountB Amount of token B added
    /// @return liquidity LP tokens minted
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external returns (uint256 amountA, uint256 amountB, uint256 liquidity);

    /// @notice Add liquidity for a token paired with native ETH (via WETH)
    /// @param token Address of ERC20 token (paired with WETH)
    /// @param amountTokenDesired Desired token amount to add
    /// @param amountTokenMin Minimum token amount to actually add
    /// @param amountETHMin Minimum ETH amount to actually add
    /// @param to Recipient of the LP tokens
    /// @param deadline Unix timestamp after which the tx is invalid
    /// @return amountToken Amount of tokens added
    /// @return amountETH Amount of ETH added
    /// @return liquidity LP tokens minted
    function addLiquidityETH(
        address token,
        uint256 amountTokenDesired,
        uint256 amountTokenMin,
        uint256 amountETHMin,
        address to,
        uint256 deadline
    ) external payable returns (uint256 amountToken, uint256 amountETH, uint256 liquidity);

    /// @notice Remove liquidity and receive underlying tokens
    /// @param tokenA Token A address
    /// @param tokenB Token B address
    /// @param liquidity LP token amount to burn
    /// @param amountAMin Minimum amount of token A to receive
    /// @param amountBMin Minimum amount of token B to receive
    /// @param to Recipient of the underlying tokens
    /// @param deadline Unix timestamp after which the tx is invalid
    /// @return amountA Amount of token A returned
    /// @return amountB Amount of token B returned
    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint256 liquidity,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external returns (uint256 amountA, uint256 amountB);

    /// @notice Remove liquidity from a pair with WETH and receive ETH
    /// @param token The non-WETH token address
    /// @param liquidity LP token amount to burn
    /// @param amountTokenMin Minimum token amount to receive
    /// @param amountETHMin Minimum ETH amount to receive
    /// @param to Recipient of the assets
    /// @param deadline Unix timestamp after which the tx is invalid
    /// @return amountToken Amount of token returned
    /// @return amountETH Amount of ETH returned
    function removeLiquidityETH(
        address token,
        uint256 liquidity,
        uint256 amountTokenMin,
        uint256 amountETHMin,
        address to,
        uint256 deadline
    ) external returns (uint256 amountToken, uint256 amountETH);

    /*//////////////////////////////////////////////////////////////
                              SWAP LOGIC
    //////////////////////////////////////////////////////////////*/

    /// @notice Swap an exact input amount for a minimum output amount across a path
    /// @param amountIn Exact input token amount
    /// @param amountOutMin Minimum acceptable output amount
    /// @param path Swap path (tokens)
    /// @param to Final recipient of output tokens
    /// @param deadline Unix timestamp after which the tx is invalid
    /// @return amounts Array of amounts for each hop (amounts[0] is input, last is output)
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);

    /// @notice Swap tokens, spending up to amountInMax to receive an exact output amount
    /// @param amountOut Exact output token amount
    /// @param amountInMax Maximum input token amount willing to spend
    /// @param path Swap path (tokens)
    /// @param to Final recipient of output tokens
    /// @param deadline Unix timestamp after which the tx is invalid
    /// @return amounts Array of amounts for each hop
    function swapTokensForExactTokens(
        uint256 amountOut,
        uint256 amountInMax,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);

    /// @notice Swap exact ETH (wrapped as WETH) for tokens
    /// @param amountOutMin Minimum acceptable output amount
    /// @param path Swap path (must start with WETH)
    /// @param to Final recipient of output tokens
    /// @param deadline Unix timestamp after which the tx is invalid
    /// @return amounts Array of amounts for each hop
    function swapExactETHForTokens(
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable returns (uint256[] memory amounts);

    /// @notice Swap tokens for an exact amount of ETH (withdrawn from WETH)
    /// @param amountOut Exact ETH amount to receive
    /// @param amountInMax Maximum token input to spend
    /// @param path Swap path (must end with WETH)
    /// @param to Recipient of ETH
    /// @param deadline Unix timestamp after which the tx is invalid
    /// @return amounts Array of amounts for each hop
    function swapTokensForExactETH(
        uint256 amountOut,
        uint256 amountInMax,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);

    /// @notice Swap exact tokens for ETH (unwrapped from WETH)
    /// @param amountIn Exact token input amount
    /// @param amountOutMin Minimum ETH output expected
    /// @param path Swap path (must end with WETH)
    /// @param to Recipient of ETH
    /// @param deadline Unix timestamp after which the tx is invalid
    /// @return amounts Array of amounts for each hop
    function swapExactTokensForETH(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);

    /*//////////////////////////////////////////////////////////////
                       PRICING/QUOTING UTILITIES
    //////////////////////////////////////////////////////////////*/

    /// @notice Given some amount of an asset and pair reserves, returns an equivalent amount of the other asset
    function quote(uint256 amountA, uint256 reserveA, uint256 reserveB) external pure returns (uint256 amountB);

    /// @notice Given an input amount of an asset and pair reserves, returns the maximum output amount of the other asset
    function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) external pure returns (uint256 amountOut);

    /// @notice Returns a required input amount of the other asset for a desired output amount given reserves
    function getAmountIn(uint256 amountOut, uint256 reserveIn, uint256 reserveOut) external pure returns (uint256 amountIn);

    /// @notice Returns output amounts for each hop along the path, given an input amount
    function getAmountsOut(uint256 amountIn, address[] calldata path) external view returns (uint256[] memory amounts);

    /// @notice Returns input amounts for each hop along the path, to obtain a final output amount
    function getAmountsIn(uint256 amountOut, address[] calldata path) external view returns (uint256[] memory amounts);
}



