// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title QuantumSwap Pair (Minimal Stub)
/// @notice Temporary minimal implementation to support deterministic deployment and initialization by the factory.
/// @dev This stub will be fully implemented in later stages.
contract QuantumSwapPair {
    /// @notice Address of the factory that deployed this pair
    address public immutable factory;

    /// @notice Token addresses for this pair
    address public token0;
    address public token1;

    constructor() {
        factory = msg.sender;
    }

    /// @notice Initializes the pair with token addresses. Callable only by the factory once.
    /// @param _token0 The address of token0
    /// @param _token1 The address of token1
    function initialize(address _token0, address _token1) external {
        require(msg.sender == factory, "PAIR: FORBIDDEN");
        require(token0 == address(0) && token1 == address(0), "PAIR: ALREADY_INIT");
        token0 = _token0;
        token1 = _token1;
    }
}



