// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IQuantumSwapFactory} from "../../interfaces/IQuantumSwapFactory.sol";
import {IQuantumSwapPair} from "../../interfaces/IQuantumSwapPair.sol";

/// @title QuantumSwap Security Audit
/// @notice Centralized security monitoring and audit functions for the QuantumSwap protocol
/// @dev This contract provides security checks and monitoring capabilities
contract SecurityAudit {
    /// @notice Address of the QuantumSwap Factory
    address public immutable factory;

    /// @notice Address authorized to perform security audits
    address public auditor;

    /// @notice Maximum allowed price impact percentage (in basis points)
    uint256 public constant MAX_PRICE_IMPACT = 1000; // 10%

    /// @notice Maximum allowed time between oracle updates (in seconds)
    uint256 public constant MAX_ORACLE_DELAY = 3600; // 1 hour

    /// @notice Events for security monitoring
    event SecurityAlert(string alertType, address indexed pair, string message);
    event AuditorChanged(address indexed oldAuditor, address indexed newAuditor);

    /// @notice Modifier to restrict access to auditor only
    modifier onlyAuditor() {
        require(msg.sender == auditor, "SECURITY: NOT_AUDITOR");
        _;
    }

    /// @notice Constructor
    /// @param _factory Address of the QuantumSwap Factory
    /// @param _auditor Initial auditor address
    constructor(address _factory, address _auditor) {
        require(_factory != address(0), "SECURITY: ZERO_FACTORY");
        require(_auditor != address(0), "SECURITY: ZERO_AUDITOR");
        factory = _factory;
        auditor = _auditor;
    }

    /// @notice Change the auditor address
    /// @param _auditor New auditor address
    function setAuditor(address _auditor) external onlyAuditor {
        require(_auditor != address(0), "SECURITY: ZERO_AUDITOR");
        address oldAuditor = auditor;
        auditor = _auditor;
        emit AuditorChanged(oldAuditor, _auditor);
    }

    /// @notice Check if a pair has suspicious activity
    /// @param pair Address of the pair to check
    /// @return isSuspicious True if suspicious activity detected
    /// @return reason Reason for suspicion
    function checkPairSecurity(address pair) external view returns (bool isSuspicious, string memory reason) {
        require(pair != address(0), "SECURITY: ZERO_PAIR");
        
        IQuantumSwapPair pairContract = IQuantumSwapPair(pair);
        
        // Check if pair exists in factory
        address token0 = pairContract.token0();
        address token1 = pairContract.token1();
        address factoryPair = IQuantumSwapFactory(factory).getPair(token0, token1);
        
        if (factoryPair != pair) {
            return (true, "Pair not registered in factory");
        }

        // Check reserves
        (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast) = pairContract.getReserves();
        
        if (reserve0 == 0 || reserve1 == 0) {
            return (true, "Zero reserves detected");
        }

        // Check for extreme price ratios
        uint256 priceRatio = (uint256(reserve1) * 10000) / uint256(reserve0);
        if (priceRatio < 1 || priceRatio > 100000000) {
            return (true, "Extreme price ratio detected");
        }

        // Check oracle delay
        uint32 currentTime = uint32(block.timestamp);
        if (currentTime > blockTimestampLast) {
            uint32 timeElapsed = currentTime - blockTimestampLast;
            if (timeElapsed > MAX_ORACLE_DELAY) {
                return (true, "Oracle update delay too long");
            }
        }

        return (false, "No suspicious activity detected");
    }

    /// @notice Check if a swap would cause excessive price impact
    /// @param pair Address of the pair
    /// @param amountIn Amount of input tokens
    /// @param isToken0 Whether the input is token0
    /// @return priceImpact Price impact in basis points
    /// @return isExcessive True if price impact exceeds maximum
    function checkPriceImpact(
        address pair,
        uint256 amountIn,
        bool isToken0
    ) external view returns (uint256 priceImpact, bool isExcessive) {
        require(pair != address(0), "SECURITY: ZERO_PAIR");
        require(amountIn > 0, "SECURITY: ZERO_AMOUNT");

        IQuantumSwapPair pairContract = IQuantumSwapPair(pair);
        (uint112 reserve0, uint112 reserve1, ) = pairContract.getReserves();

        uint256 reserveIn = isToken0 ? uint256(reserve0) : uint256(reserve1);
        priceImpact = (amountIn * 10000) / reserveIn;

        isExcessive = priceImpact > MAX_PRICE_IMPACT;
    }

    /// @notice Emergency function to flag suspicious pairs
    /// @param pair Address of the suspicious pair
    /// @param reason Reason for flagging
    function flagSuspiciousPair(address pair, string calldata reason) external onlyAuditor {
        require(pair != address(0), "SECURITY: ZERO_PAIR");
        emit SecurityAlert("SUSPICIOUS_PAIR", pair, reason);
    }

    /// @notice Check factory security status
    /// @return isSecure True if factory is secure
    /// @return issues Array of security issues found
    function checkFactorySecurity() external view returns (bool isSecure, string[] memory issues) {
        IQuantumSwapFactory factoryContract = IQuantumSwapFactory(factory);
        
        // Check if factory is paused
        bool factoryPaused = factoryContract.paused();

        if (factoryPaused) {
            string[] memory tempIssues = new string[](1);
            tempIssues[0] = "Factory is paused";
            return (false, tempIssues);
        }

        // Check total pairs count
        uint256 totalPairs = factoryContract.allPairsLength();
        if (totalPairs == 0) {
            string[] memory tempIssues = new string[](1);
            tempIssues[0] = "No pairs created";
            return (false, tempIssues);
        }

        // If no issues found
        string[] memory emptyIssues = new string[](0);
        return (true, emptyIssues);
    }

    /// @notice Get security metrics for a specific pair
    /// @param pair Address of the pair
    /// @return reserve0 Reserve of token0
    /// @return reserve1 Reserve of token1
    /// @return lastUpdate Last update timestamp
    /// @return price0Cumulative Cumulative price of token0
    /// @return price1Cumulative Cumulative price of token1
    /// @return kLast Last k value
    function getPairMetrics(address pair) external view returns (
        uint256 reserve0,
        uint256 reserve1,
        uint32 lastUpdate,
        uint256 price0Cumulative,
        uint256 price1Cumulative,
        uint256 kLast
    ) {
        require(pair != address(0), "SECURITY: ZERO_PAIR");
        
        IQuantumSwapPair pairContract = IQuantumSwapPair(pair);
        (uint112 r0, uint112 r1, uint32 lastUp) = pairContract.getReserves();
        
        reserve0 = uint256(r0);
        reserve1 = uint256(r1);
        lastUpdate = lastUp;
        price0Cumulative = pairContract.price0CumulativeLast();
        price1Cumulative = pairContract.price1CumulativeLast();
        kLast = pairContract.kLast();
    }
}
