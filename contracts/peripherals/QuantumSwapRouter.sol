// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IQuantumSwapRouter} from "../../interfaces/IQuantumSwapRouter.sol";
import {IQuantumSwapFactory} from "../../interfaces/IQuantumSwapFactory.sol";
import {IQuantumSwapPair} from "../../interfaces/IQuantumSwapPair.sol";
import {IERC20} from "../../interfaces/IERC20.sol";

interface IWETH {
	function deposit() external payable;
	function withdraw(uint256) external;
}

/// @title QuantumSwap Router
/// @notice Stateless periphery for adding/removing liquidity and performing swaps through QuantumSwap.
contract QuantumSwapRouter is IQuantumSwapRouter {
	address public immutable factory;
	address public immutable WETH;

	modifier ensure(uint256 deadline) {
		require(block.timestamp <= deadline, "QuantumSwap: EXPIRED");
		_;
	}

	constructor(address _factory, address _weth) {
		require(_factory != address(0) && _weth != address(0), "Router: ZERO_ADDRESS");
		factory = _factory;
		WETH = _weth;
	}

	/*//////////////////////////////////////////////////////////////
						INTERNAL HELPERS
	//////////////////////////////////////////////////////////////*/

	function _pairFor(address tokenA, address tokenB) internal view returns (address pair) {
		pair = IQuantumSwapFactory(factory).getPair(tokenA, tokenB);
	}

	function _sortTokens(address tokenA, address tokenB) internal pure returns (address token0, address token1) {
		require(tokenA != tokenB, "Router: IDENTICAL_ADDRESSES");
		(token0, token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
		require(token0 != address(0), "Router: ZERO_ADDRESS");
	}

	function _quote(uint256 amountA, uint256 reserveA, uint256 reserveB) internal pure returns (uint256 amountB) {
		require(amountA > 0, "Router: INSUFFICIENT_AMOUNT");
		require(reserveA > 0 && reserveB > 0, "Router: INSUFFICIENT_LIQUIDITY");
		amountB = (amountA * reserveB) / reserveA;
	}

	function _getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) internal pure returns (uint256 amountOut) {
		require(amountIn > 0, "Router: INSUFFICIENT_INPUT");
		require(reserveIn > 0 && reserveOut > 0, "Router: INSUFFICIENT_LIQUIDITY");
		uint256 amountInWithFee = amountIn * 997;
		uint256 numerator = amountInWithFee * reserveOut;
		uint256 denominator = reserveIn * 1000 + amountInWithFee;
		amountOut = numerator / denominator;
	}

	function _getAmountIn(uint256 amountOut, uint256 reserveIn, uint256 reserveOut) internal pure returns (uint256 amountIn) {
		require(amountOut > 0, "Router: INSUFFICIENT_OUTPUT");
		require(reserveIn > 0 && reserveOut > 0, "Router: INSUFFICIENT_LIQUIDITY");
		uint256 numerator = reserveIn * amountOut * 1000;
		uint256 denominator = (reserveOut - amountOut) * 997;
		amountIn = numerator / denominator + 1;
	}

	function _getAmountsOut(uint256 amountIn, address[] memory path) internal view returns (uint256[] memory amounts) {
		amounts = new uint256[](path.length);
		amounts[0] = amountIn;
		for (uint256 i = 0; i < path.length - 1; i++) {
			address input = path[i];
			address output = path[i + 1];
			address pair = _pairFor(input, output);
			require(pair != address(0), "Router: PAIR_NOT_EXISTS");
			(address token0, ) = _sortTokens(input, output);
			(uint112 reserve0, uint112 reserve1, ) = IQuantumSwapPair(pair).getReserves();
			(uint256 reserveIn, uint256 reserveOut) = input == token0 ? (reserve0, reserve1) : (reserve1, reserve0);
			amounts[i + 1] = _getAmountOut(amounts[i], reserveIn, reserveOut);
		}
	}

	function _getAmountsIn(uint256 amountOut, address[] memory path) internal view returns (uint256[] memory amounts) {
		amounts = new uint256[](path.length);
		amounts[amounts.length - 1] = amountOut;
		for (uint256 i = path.length - 1; i > 0; i--) {
			address input = path[i - 1];
			address output = path[i];
			address pair = _pairFor(input, output);
			require(pair != address(0), "Router: PAIR_NOT_EXISTS");
			(address token0, ) = _sortTokens(input, output);
			(uint112 reserve0, uint112 reserve1, ) = IQuantumSwapPair(pair).getReserves();
			(uint256 reserveIn, uint256 reserveOut) = input == token0 ? (reserve0, reserve1) : (reserve1, reserve0);
			amounts[i - 1] = _getAmountIn(amounts[i], reserveIn, reserveOut);
		}
	}

	function _safeTransfer(address token, address to, uint256 value) private {
		(bool s, bytes memory d) = token.call(abi.encodeWithSelector(IERC20.transfer.selector, to, value));
		require(s && (d.length == 0 || abi.decode(d, (bool))), "Router: TRANSFER_FAILED");
	}

	function _safeTransferFrom(address token, address from, address to, uint256 value) private {
		(bool s, bytes memory d) = token.call(abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, value));
		require(s && (d.length == 0 || abi.decode(d, (bool))), "Router: TRANSFER_FROM_FAILED");
	}

	function _addLiquidity(
		address tokenA,
		address tokenB,
		uint256 amountADesired,
		uint256 amountBDesired,
		uint256 amountAMin,
		uint256 amountBMin
	) private returns (uint256 amountA, uint256 amountB, address pair) {
		address _pair = IQuantumSwapFactory(factory).getPair(tokenA, tokenB);
		if (_pair == address(0)) {
			_pair = IQuantumSwapFactory(factory).createPair(tokenA, tokenB);
		}
		pair = _pair;
		(uint112 reserve0, uint112 reserve1, ) = IQuantumSwapPair(pair).getReserves();
		(address token0, ) = _sortTokens(tokenA, tokenB);
		(uint256 reserveA, uint256 reserveB) = tokenA == token0 ? (reserve0, reserve1) : (reserve1, reserve0);
		if (reserveA == 0 && reserveB == 0) {
			(amountA, amountB) = (amountADesired, amountBDesired);
		} else {
			uint256 amountBOptimal = _quote(amountADesired, reserveA, reserveB);
			if (amountBOptimal <= amountBDesired) {
				require(amountBOptimal >= amountBMin, "Router: INSUFFICIENT_B_BMIN");
				(amountA, amountB) = (amountADesired, amountBOptimal);
			} else {
				uint256 amountAOptimal = _quote(amountBDesired, reserveB, reserveA);
				require(amountAOptimal >= amountAMin, "Router: INSUFFICIENT_A_AMIN");
				(amountA, amountB) = (amountAOptimal, amountBDesired);
			}
		}
	}

	function _swap(uint256[] memory amounts, address[] memory path, address _to) private {
		for (uint256 i = 0; i < path.length - 1; i++) {
			address input = path[i];
			address output = path[i + 1];
			(address token0, ) = _sortTokens(input, output);
			uint256 amountOut = amounts[i + 1];
			(uint256 amount0Out, uint256 amount1Out) = input == token0 ? (uint256(0), amountOut) : (amountOut, uint256(0));
			address to = i < path.length - 2 ? _pairFor(output, path[i + 2]) : _to;
			IQuantumSwapPair(_pairFor(input, output)).swap(amount0Out, amount1Out, to, new bytes(0));
		}
	}

	/*//////////////////////////////////////////////////////////////
						 LIQUIDITY ACTIONS
	//////////////////////////////////////////////////////////////*/

	function addLiquidity(
		address tokenA,
		address tokenB,
		uint256 amountADesired,
		uint256 amountBDesired,
		uint256 amountAMin,
		uint256 amountBMin,
		address to,
		uint256 deadline
	) external ensure(deadline) returns (uint256 amountA, uint256 amountB, uint256 liquidity) {
		address pair;
		(amountA, amountB, pair) = _addLiquidity(tokenA, tokenB, amountADesired, amountBDesired, amountAMin, amountBMin);
		_safeTransferFrom(tokenA, msg.sender, pair, amountA);
		_safeTransferFrom(tokenB, msg.sender, pair, amountB);
		liquidity = IQuantumSwapPair(pair).mint(to);
	}

	function addLiquidityETH(
		address token,
		uint256 amountTokenDesired,
		uint256 amountTokenMin,
		uint256 amountETHMin,
		address to,
		uint256 deadline
	) external payable ensure(deadline) returns (uint256 amountToken, uint256 amountETH, uint256 liquidity) {
		address pair;
		(amountToken, amountETH, pair) = _addLiquidity(token, WETH, amountTokenDesired, msg.value, amountTokenMin, amountETHMin);
		_safeTransferFrom(token, msg.sender, pair, amountToken);
		IWETH(WETH).deposit{value: amountETH}();
		_safeTransfer(WETH, pair, amountETH);
		liquidity = IQuantumSwapPair(pair).mint(to);
		// refund dust ETH, if any
		if (msg.value > amountETH) {
			(bool s, ) = msg.sender.call{value: msg.value - amountETH}("");
			require(s, "Router: REFUND_FAIL");
		}
	}

	receive() external payable {
		require(msg.sender == WETH, "Router: ETH_ONLY_WETH");
	}

	function removeLiquidity(
		address tokenA,
		address tokenB,
		uint256 liquidity,
		uint256 amountAMin,
		uint256 amountBMin,
		address to,
		uint256 deadline
	) external ensure(deadline) returns (uint256 amountA, uint256 amountB) {
		address pair = _pairFor(tokenA, tokenB);
		_safeTransferFrom(pair, msg.sender, pair, liquidity); // send LP tokens to pair
		(uint256 amount0, uint256 amount1) = IQuantumSwapPair(pair).burn(to);
		(address token0, ) = _sortTokens(tokenA, tokenB);
		(amountA, amountB) = tokenA == token0 ? (amount0, amount1) : (amount1, amount0);
		require(amountA >= amountAMin && amountB >= amountBMin, "Router: INSUFFICIENT_OUT");
	}

	function removeLiquidityETH(
		address token,
		uint256 liquidity,
		uint256 amountTokenMin,
		uint256 amountETHMin,
		address to,
		uint256 deadline
	) external ensure(deadline) returns (uint256 amountToken, uint256 amountETH) {
		address pair = _pairFor(token, WETH);
		_safeTransferFrom(pair, msg.sender, pair, liquidity); // send LP tokens to pair
		(uint256 amount0, uint256 amount1) = IQuantumSwapPair(pair).burn(address(this));
		(address token0, ) = _sortTokens(token, WETH);
		(amountToken, amountETH) = token == token0 ? (amount0, amount1) : (amount1, amount0);
		require(amountToken >= amountTokenMin && amountETH >= amountETHMin, "Router: INSUFFICIENT_OUT");
		_safeTransfer(token, to, amountToken);
		IWETH(WETH).withdraw(amountETH);
		(bool s, ) = to.call{value: amountETH}("");
		require(s, "Router: ETH_TRANSFER_FAIL");
	}

	/*//////////////////////////////////////////////////////////////
							  SWAPS
	//////////////////////////////////////////////////////////////*/

	function swapExactTokensForTokens(
		uint256 amountIn,
		uint256 amountOutMin,
		address[] calldata path,
		address to,
		uint256 deadline
	) external ensure(deadline) returns (uint256[] memory amounts) {
		amounts = _getAmountsOut(amountIn, path);
		require(amounts[amounts.length - 1] >= amountOutMin, "Router: INSUFFICIENT_OUTPUT");
		_safeTransferFrom(path[0], msg.sender, _pairFor(path[0], path[1]), amounts[0]);
		_swap(amounts, path, to);
	}

	function swapTokensForExactTokens(
		uint256 amountOut,
		uint256 amountInMax,
		address[] calldata path,
		address to,
		uint256 deadline
	) external ensure(deadline) returns (uint256[] memory amounts) {
		amounts = _getAmountsIn(amountOut, path);
		require(amounts[0] <= amountInMax, "Router: EXCESSIVE_INPUT");
		_safeTransferFrom(path[0], msg.sender, _pairFor(path[0], path[1]), amounts[0]);
		_swap(amounts, path, to);
	}

	function swapExactETHForTokens(
		uint256 amountOutMin,
		address[] calldata path,
		address to,
		uint256 deadline
	) external payable ensure(deadline) returns (uint256[] memory amounts) {
		require(path[0] == WETH, "Router: PATH_MUST_START_WETH");
		amounts = _getAmountsOut(msg.value, path);
		require(amounts[amounts.length - 1] >= amountOutMin, "Router: INSUFFICIENT_OUTPUT");
		IWETH(WETH).deposit{value: amounts[0]}();
		_safeTransfer(WETH, _pairFor(path[0], path[1]), amounts[0]);
		_swap(amounts, path, to);
	}

	function swapTokensForExactETH(
		uint256 amountOut,
		uint256 amountInMax,
		address[] calldata path,
		address to,
		uint256 deadline
	) external ensure(deadline) returns (uint256[] memory amounts) {
		require(path[path.length - 1] == WETH, "Router: PATH_MUST_END_WETH");
		amounts = _getAmountsIn(amountOut, path);
		require(amounts[0] <= amountInMax, "Router: EXCESSIVE_INPUT");
		_safeTransferFrom(path[0], msg.sender, _pairFor(path[0], path[1]), amounts[0]);
		_swap(amounts, path, address(this));
		IWETH(WETH).withdraw(amounts[amounts.length - 1]);
		(bool s, ) = to.call{value: amounts[amounts.length - 1]}("");
		require(s, "Router: ETH_TRANSFER_FAIL");
	}

	function swapExactTokensForETH(
		uint256 amountIn,
		uint256 amountOutMin,
		address[] calldata path,
		address to,
		uint256 deadline
	) external ensure(deadline) returns (uint256[] memory amounts) {
		require(path[path.length - 1] == WETH, "Router: PATH_MUST_END_WETH");
		amounts = _getAmountsOut(amountIn, path);
		require(amounts[amounts.length - 1] >= amountOutMin, "Router: INSUFFICIENT_OUTPUT");
		_safeTransferFrom(path[0], msg.sender, _pairFor(path[0], path[1]), amounts[0]);
		_swap(amounts, path, address(this));
		IWETH(WETH).withdraw(amounts[amounts.length - 1]);
		(bool s, ) = to.call{value: amounts[amounts.length - 1]}("");
		require(s, "Router: ETH_TRANSFER_FAIL");
	}

	/*//////////////////////////////////////////////////////////////
					PRICING/QUOTING (EXTERNAL)
	//////////////////////////////////////////////////////////////*/

	function quote(uint256 amountA, uint256 reserveA, uint256 reserveB) external pure returns (uint256 amountB) {
		return _quote(amountA, reserveA, reserveB);
	}

	function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) external pure returns (uint256 amountOut) {
		return _getAmountOut(amountIn, reserveIn, reserveOut);
	}

	function getAmountIn(uint256 amountOut, uint256 reserveIn, uint256 reserveOut) external pure returns (uint256 amountIn) {
		return _getAmountIn(amountOut, reserveIn, reserveOut);
	}

	function getAmountsOut(uint256 amountIn, address[] calldata path) external view returns (uint256[] memory amounts) {
		return _getAmountsOut(amountIn, path);
	}

	function getAmountsIn(uint256 amountOut, address[] calldata path) external view returns (uint256[] memory amounts) {
		return _getAmountsIn(amountOut, path);
	}
}


