// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Math
/// @notice Minimal, gas-efficient math utilities.
library Math {
    /// @notice Returns the smaller of two unsigned integers.
    /// @param x The first value
    /// @param y The second value
    /// @return z The minimum of x and y
    function min(uint256 x, uint256 y) internal pure returns (uint256 z) {
        z = x < y ? x : y;
    }

    /// @notice Returns the integer square root of y, i.e., floor(sqrt(y)).
    /// @dev Uses the Babylonian method; gas-efficient for arbitrary y. Returns 0 if y == 0.
    /// @param y The value to sqrt
    /// @return z The integer square root of y
    function sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y == 0) {
            return 0;
        }

        // Initial guess: y/2 + 1, then iteratively refine.
        uint256 x = y / 2 + 1;
        z = y;
        while (x < z) {
            z = x;
            x = (y / x + x) / 2;
        }
    }
}



