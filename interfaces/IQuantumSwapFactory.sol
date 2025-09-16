// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title QuantumSwap Factory Interface
/// @notice Defines the external interface for the QuantumSwap Factory responsible for creating and tracking pairs.
/// @dev External contracts use this interface to discover pairs and manage protocol fee parameters.
interface IQuantumSwapFactory {
    /// @notice Emitted when a new pair is created for `token0` and `token1`.
    /// @param token0 The address of token0 of the pair (sorted ascending)
    /// @param token1 The address of token1 of the pair (sorted ascending)
    /// @param pair The newly created pair address
    /// @param allPairsLength The total number of pairs after creation
    event PairCreated(address indexed token0, address indexed token1, address pair, uint256 allPairsLength);

    /// @notice Returns the address to which protocol fees are sent.
    /// @return feeRecipient The address that receives protocol fees
    function feeTo() external view returns (address feeRecipient);

    /// @notice Returns the address with permission to set the protocol fee recipient.
    /// @return feeSetter The address authorized to change `feeTo`
    function feeToSetter() external view returns (address feeSetter);

    /// @notice Returns the pair address for `tokenA` and `tokenB`, or address(0) if it doesn't exist.
    /// @dev Token ordering is canonicalized internally (sorted addresses).
    /// @param tokenA The first token address
    /// @param tokenB The second token address
    /// @return pair The pair address for the two tokens (or address(0))
    function getPair(address tokenA, address tokenB) external view returns (address pair);

    /// @notice Returns the pair address at the given index of all created pairs.
    /// @param index The pair index in the global list
    /// @return pair The pair address at the given index
    function allPairs(uint256 index) external view returns (address pair);

    /// @notice Returns the total number of pairs created by the factory.
    /// @return count The total number of pairs
    function allPairsLength() external view returns (uint256 count);

    /// @notice Creates a pair for tokens `tokenA` and `tokenB` if it doesn't exist.
    /// @dev Reverts if the pair already exists or if `tokenA == tokenB` or either is the zero address.
    /// @param tokenA The first token address
    /// @param tokenB The second token address
    /// @return pair The address of the newly created pair
    function createPair(address tokenA, address tokenB) external returns (address pair);

    /// @notice Sets the protocol fee recipient address.
    /// @dev Only callable by `feeToSetter`.
    /// @param _feeTo The new fee recipient address
    function setFeeTo(address _feeTo) external;

    /// @notice Sets the address authorized to change the protocol fee recipient.
    /// @dev Only callable by the current `feeToSetter`.
    /// @param _feeToSetter The new fee setter address
    function setFeeToSetter(address _feeToSetter) external;

    /// @notice Returns the pause state of the factory
    /// @return paused True if the factory is paused
    function paused() external view returns (bool paused);
}



