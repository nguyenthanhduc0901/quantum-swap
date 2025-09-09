// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IQuantumSwapFactory} from "../../interfaces/IQuantumSwapFactory.sol";
import {IQuantumSwapPair} from "../../interfaces/IQuantumSwapPair.sol";
import {QuantumSwapPair} from "./QuantumSwapPair.sol";

/// @title QuantumSwap Factory
/// @notice Deploys and tracks QuantumSwap liquidity pairs using CREATE2 for deterministic addresses.
contract QuantumSwapFactory is IQuantumSwapFactory {
    /// @inheritdoc IQuantumSwapFactory
    address public override feeTo;

    /// @inheritdoc IQuantumSwapFactory
    address public override feeToSetter;

    /// @inheritdoc IQuantumSwapFactory
    mapping(address => mapping(address => address)) public override getPair;

    /// @notice List of all pairs created by the factory
    address[] public override allPairs;

    /// @notice Initializes the factory with a fee setter
    /// @param _feeToSetter The initial address authorized to set the protocol fee recipient
    constructor(address _feeToSetter) {
        feeToSetter = _feeToSetter;
    }

    /// @inheritdoc IQuantumSwapFactory
    function allPairsLength() external view override returns (uint256) {
        return allPairs.length;
    }

    /// @inheritdoc IQuantumSwapFactory
    function createPair(address tokenA, address tokenB) external override returns (address pair) {
        require(tokenA != tokenB, "FACTORY: IDENTICAL_ADDRESSES");

        // Sort tokens to enforce uniqueness
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0), "FACTORY: ZERO_ADDRESS");
        require(getPair[token0][token1] == address(0), "FACTORY: PAIR_EXISTS");

        bytes memory bytecode = type(QuantumSwapPair).creationCode;
        bytes32 salt = keccak256(abi.encodePacked(token0, token1));

        assembly {
            let encoded_data := add(bytecode, 0x20)
            let encoded_size := mload(bytecode)
            pair := create2(0, encoded_data, encoded_size, salt)
        }
        require(pair != address(0), "FACTORY: CREATE2_FAILED");

        IQuantumSwapPair(pair).initialize(token0, token1);

        getPair[token0][token1] = pair;
        getPair[token1][token0] = pair;
        allPairs.push(pair);

        emit PairCreated(token0, token1, pair, allPairs.length);
    }

    /// @inheritdoc IQuantumSwapFactory
    function setFeeTo(address _feeTo) external override {
        require(msg.sender == feeToSetter, "FACTORY: FORBIDDEN");
        feeTo = _feeTo;
    }

    /// @inheritdoc IQuantumSwapFactory
    function setFeeToSetter(address _feeToSetter) external override {
        require(msg.sender == feeToSetter, "FACTORY: FORBIDDEN");
        feeToSetter = _feeToSetter;
    }
}



