// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ERC-20 Token Standard Interface (with EIP-2612 Permit)
/// @notice Standard interface for ERC-20 fungible tokens, augmented with the EIP-2612 permit extension for approvals via signatures.
/// @dev This interface combines the canonical ERC-20 view/mutation methods with the EIP-2612 `permit` to enable gasless approvals.
interface IERC20 {
    /// @notice Emitted when `value` tokens are moved from one account (`from`) to another (`to`).
    /// @param from The address tokens are moved from
    /// @param to The address tokens are moved to
    /// @param value The amount of tokens transferred
    event Transfer(address indexed from, address indexed to, uint256 value);

    /// @notice Emitted when the allowance of a `spender` for an `owner` is set by a call to {approve}. `value` is the new allowance.
    /// @param owner The address granting the allowance
    /// @param spender The address receiving the allowance
    /// @param value The allowance amount approved
    event Approval(address indexed owner, address indexed spender, uint256 value);

    /// @notice Returns the name of the token.
    /// @return tokenName The token name string
    function name() external view returns (string memory tokenName);

    /// @notice Returns the symbol of the token, usually a shorter version of the name.
    /// @return tokenSymbol The token symbol string
    function symbol() external view returns (string memory tokenSymbol);

    /// @notice Returns the number of decimals used to get its user representation.
    /// @return tokenDecimals The number of decimals
    function decimals() external view returns (uint8 tokenDecimals);

    /// @notice Returns the amount of tokens in existence.
    /// @return supply The total token supply
    function totalSupply() external view returns (uint256 supply);

    /// @notice Returns the amount of tokens owned by `account`.
    /// @param account The address to query the balance of
    /// @return balance The balance of the requested account
    function balanceOf(address account) external view returns (uint256 balance);

    /// @notice Moves `value` tokens from the caller's account to `to`.
    /// @param to The recipient address
    /// @param value The amount to transfer
    /// @return success True if the operation succeeded
    function transfer(address to, uint256 value) external returns (bool success);

    /// @notice Returns the remaining number of tokens that `spender` will be allowed to spend on behalf of `owner` through {transferFrom}.
    /// @param owner The token owner's address
    /// @param spender The spender's address
    /// @return remaining The remaining allowance
    function allowance(address owner, address spender) external view returns (uint256 remaining);

    /// @notice Sets `value` as the allowance of `spender` over the caller's tokens.
    /// @param spender The address authorized to spend
    /// @param value The allowance amount
    /// @return success True if the operation succeeded
    function approve(address spender, uint256 value) external returns (bool success);

    /// @notice Moves `value` tokens from `from` to `to` using the allowance mechanism.
    /// @param from The address to move tokens from
    /// @param to The address to move tokens to
    /// @param value The amount of tokens to move
    /// @return success True if the operation succeeded
    function transferFrom(address from, address to, uint256 value) external returns (bool success);

    // ==============================
    // EIP-2612: permit-by-signature
    // ==============================

    /// @notice Sets `value` as the allowance of `spender` over `owner`'s tokens, given `owner`'s signed approval.
    /// @dev Implements EIP-2612. The signature's `deadline` must be a future timestamp. Emits an {Approval} event.
    /// @param owner The token owner giving approval by signature
    /// @param spender The address authorized to spend the owner's tokens
    /// @param value The allowance amount to set via signature
    /// @param deadline The timestamp (in seconds) after which the signature is invalid
    /// @param v The recovery id component of the ECDSA signature
    /// @param r The first 32 bytes of the ECDSA signature
    /// @param s The second 32 bytes of the ECDSA signature
    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;

    /// @notice Returns the current nonce for `owner`. Must be included whenever a signature is generated for {permit}.
    /// @dev Each successful call to {permit} increases `owner`'s nonce by one, preventing signature replays.
    /// @param owner The address to query the current permit nonce for
    /// @return currentNonce The current nonce for `owner`
    function nonces(address owner) external view returns (uint256 currentNonce);

    /// @notice Returns the EIP-712 domain separator used in the {permit} signature encoding.
    /// @return domainSeparator The EIP-712 domain separator
    function DOMAIN_SEPARATOR() external view returns (bytes32 domainSeparator);
}



