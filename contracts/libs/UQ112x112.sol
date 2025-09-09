// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title UQ112x112 Fixed-Point Math
/// @notice Utilities for 112.112 fixed-point representation used by the TWAP oracle.
library UQ112x112 {
    /// @dev Number of fractional bits
    uint224 internal constant Q112 = 2 ** 112;

    /// @dev Fixed-point struct holding the raw value
    struct UQ {
        uint224 q;
    }

    /// @notice Encodes a uint112 as a UQ112x112 fixed-point number.
    /// @param y The unsigned integer to encode
    /// @return uq The fixed-point representation of y
    function encode(uint112 y) internal pure returns (UQ memory uq) {
        uq = UQ(uint224(y) * Q112);
    }

    /// @notice Divides a UQ112x112 fixed-point number by a uint112 denominator.
    /// @dev Reverts on division by zero. Result is another UQ112x112 value.
    /// @param self The numerator in fixed-point form
    /// @param y The uint112 denominator
    /// @return uq The result of the division in fixed-point form
    function uqdiv(UQ memory self, uint112 y) internal pure returns (UQ memory uq) {
        require(y != 0, "UQ112x112: DIV_BY_ZERO");
        uq = UQ(self.q / uint224(y));
    }
}



