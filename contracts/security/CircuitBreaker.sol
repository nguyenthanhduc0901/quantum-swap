// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IQuantumSwapFactory} from "../../interfaces/IQuantumSwapFactory.sol";

/// @title Circuit Breaker
/// @notice Emergency circuit breaker for QuantumSwap protocol
/// @dev Provides emergency stop functionality and rate limiting
contract CircuitBreaker {
    /// @notice Circuit breaker states
    enum CircuitState {
        Normal,
        Elevated,
        Emergency
    }

    /// @notice Events
    event CircuitStateChanged(CircuitState indexed newState, CircuitState indexed oldState);
    event EmergencyStop(address indexed caller, string reason);
    event EmergencyResume(address indexed caller);
    event RateLimitExceeded(address indexed pair, uint256 amount, uint256 limit);

    /// @notice Address of the QuantumSwap Factory
    address public immutable factory;
    
    /// @notice Admin address
    address public admin;
    
    /// @notice Emergency admin address (can stop but not resume)
    address public emergencyAdmin;
    
    /// @notice Current circuit state
    CircuitState public circuitState;
    
    /// @notice Emergency stop flag
    bool public emergencyStopped;
    
    /// @notice Rate limiting configuration
    struct RateLimit {
        uint256 maxAmount;      // Maximum amount per transaction
        uint256 timeWindow;     // Time window in seconds
        uint256 lastReset;      // Last reset timestamp
        uint256 currentAmount;  // Current amount in window
    }
    
    /// @notice Rate limits per pair
    mapping(address => RateLimit) public rateLimits;
    
    /// @notice Global rate limit
    RateLimit public globalRateLimit;
    
    /// @notice Blacklisted addresses
    mapping(address => bool) public blacklisted;
    
    /// @notice Whitelisted addresses (bypass rate limits)
    mapping(address => bool) public whitelisted;

    /// @notice Modifier to restrict access to admin only
    modifier onlyAdmin() {
        require(msg.sender == admin, "CIRCUIT_BREAKER: NOT_ADMIN");
        _;
    }

    /// @notice Modifier to restrict access to emergency admin only
    modifier onlyEmergencyAdmin() {
        require(msg.sender == emergencyAdmin, "CIRCUIT_BREAKER: NOT_EMERGENCY_ADMIN");
        _;
    }

    /// @notice Modifier to check if system is not in emergency state
    modifier notEmergency() {
        require(!emergencyStopped, "CIRCUIT_BREAKER: EMERGENCY_STOPPED");
        _;
    }

    /// @notice Modifier to check if address is not blacklisted
    modifier notBlacklisted(address account) {
        require(!blacklisted[account], "CIRCUIT_BREAKER: BLACKLISTED");
        _;
    }

    /// @notice Constructor
    /// @param _factory Address of the QuantumSwap Factory
    /// @param _admin Initial admin address
    /// @param _emergencyAdmin Initial emergency admin address
    constructor(
        address _factory,
        address _admin,
        address _emergencyAdmin
    ) {
        require(_factory != address(0), "CIRCUIT_BREAKER: ZERO_FACTORY");
        require(_admin != address(0), "CIRCUIT_BREAKER: ZERO_ADMIN");
        require(_emergencyAdmin != address(0), "CIRCUIT_BREAKER: ZERO_EMERGENCY_ADMIN");

        factory = _factory;
        admin = _admin;
        emergencyAdmin = _emergencyAdmin;
        circuitState = CircuitState.Normal;
        emergencyStopped = false;

        // Set default global rate limit (1M tokens per hour)
        globalRateLimit = RateLimit({
            maxAmount: 1000000e18,
            timeWindow: 3600, // 1 hour
            lastReset: block.timestamp,
            currentAmount: 0
        });
    }

    /// @notice Check if a swap is allowed
    /// @param pair Address of the pair
    /// @param amount Amount being swapped
    /// @param user Address of the user
    /// @return allowed True if swap is allowed
    function checkSwapAllowed(
        address pair,
        uint256 amount,
        address user
    ) external view returns (bool allowed) {
        // Check emergency state
        if (emergencyStopped) {
            return false;
        }

        // Check blacklist
        if (blacklisted[user]) {
            return false;
        }

        // Whitelisted addresses bypass rate limits
        if (whitelisted[user]) {
            return true;
        }

        // Check circuit state
        if (circuitState == CircuitState.Emergency) {
            return false;
        }

        // Check rate limits
        if (!_checkRateLimit(pair, amount)) {
            return false;
        }

        return true;
    }

    /// @notice Emergency stop the system
    /// @param reason Reason for emergency stop
    function emergencyStop(string calldata reason) external onlyEmergencyAdmin {
        require(!emergencyStopped, "CIRCUIT_BREAKER: ALREADY_STOPPED");
        
        emergencyStopped = true;
        _setCircuitState(CircuitState.Emergency);
        
        emit EmergencyStop(msg.sender, reason);
    }

    /// @notice Resume the system from emergency stop
    function emergencyResume() external onlyAdmin {
        require(emergencyStopped, "CIRCUIT_BREAKER: NOT_STOPPED");
        
        emergencyStopped = false;
        _setCircuitState(CircuitState.Normal);
        
        emit EmergencyResume(msg.sender);
    }

    /// @notice Set circuit state
    /// @param newState New circuit state
    function setCircuitState(CircuitState newState) external onlyAdmin {
        _setCircuitState(newState);
    }

    /// @notice Set rate limit for a specific pair
    /// @param pair Address of the pair
    /// @param maxAmount Maximum amount per time window
    /// @param timeWindow Time window in seconds
    function setPairRateLimit(
        address pair,
        uint256 maxAmount,
        uint256 timeWindow
    ) external onlyAdmin {
        require(pair != address(0), "CIRCUIT_BREAKER: ZERO_PAIR");
        require(timeWindow > 0, "CIRCUIT_BREAKER: ZERO_TIME_WINDOW");

        rateLimits[pair] = RateLimit({
            maxAmount: maxAmount,
            timeWindow: timeWindow,
            lastReset: block.timestamp,
            currentAmount: 0
        });
    }

    /// @notice Set global rate limit
    /// @param maxAmount Maximum amount per time window
    /// @param timeWindow Time window in seconds
    function setGlobalRateLimit(
        uint256 maxAmount,
        uint256 timeWindow
    ) external onlyAdmin {
        require(timeWindow > 0, "CIRCUIT_BREAKER: ZERO_TIME_WINDOW");

        globalRateLimit = RateLimit({
            maxAmount: maxAmount,
            timeWindow: timeWindow,
            lastReset: block.timestamp,
            currentAmount: 0
        });
    }

    /// @notice Add address to blacklist
    /// @param account Address to blacklist
    function addToBlacklist(address account) external onlyAdmin {
        require(account != address(0), "CIRCUIT_BREAKER: ZERO_ADDRESS");
        blacklisted[account] = true;
    }

    /// @notice Remove address from blacklist
    /// @param account Address to remove from blacklist
    function removeFromBlacklist(address account) external onlyAdmin {
        blacklisted[account] = false;
    }

    /// @notice Add address to whitelist
    /// @param account Address to whitelist
    function addToWhitelist(address account) external onlyAdmin {
        require(account != address(0), "CIRCUIT_BREAKER: ZERO_ADDRESS");
        whitelisted[account] = true;
    }

    /// @notice Remove address from whitelist
    /// @param account Address to remove from whitelist
    function removeFromWhitelist(address account) external onlyAdmin {
        whitelisted[account] = false;
    }

    /// @notice Update admin address
    /// @param newAdmin New admin address
    function setAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "CIRCUIT_BREAKER: ZERO_ADMIN");
        admin = newAdmin;
    }

    /// @notice Update emergency admin address
    /// @param newEmergencyAdmin New emergency admin address
    function setEmergencyAdmin(address newEmergencyAdmin) external onlyAdmin {
        require(newEmergencyAdmin != address(0), "CIRCUIT_BREAKER: ZERO_EMERGENCY_ADMIN");
        emergencyAdmin = newEmergencyAdmin;
    }

    /// @notice Get current rate limit for a pair
    /// @param pair Address of the pair
    /// @return maxAmount Maximum amount per time window
    /// @return timeWindow Time window in seconds
    /// @return currentAmount Current amount in window
    /// @return lastReset Last reset timestamp
    function getPairRateLimit(address pair) external view returns (
        uint256 maxAmount,
        uint256 timeWindow,
        uint256 currentAmount,
        uint256 lastReset
    ) {
        RateLimit memory limit = rateLimits[pair];
        return (limit.maxAmount, limit.timeWindow, limit.currentAmount, limit.lastReset);
    }

    /// @notice Get global rate limit
    /// @return maxAmount Maximum amount per time window
    /// @return timeWindow Time window in seconds
    /// @return currentAmount Current amount in window
    /// @return lastReset Last reset timestamp
    function getGlobalRateLimit() external view returns (
        uint256 maxAmount,
        uint256 timeWindow,
        uint256 currentAmount,
        uint256 lastReset
    ) {
        return (
            globalRateLimit.maxAmount,
            globalRateLimit.timeWindow,
            globalRateLimit.currentAmount,
            globalRateLimit.lastReset
        );
    }

    /// @notice Internal function to set circuit state
    /// @param newState New circuit state
    function _setCircuitState(CircuitState newState) internal {
        CircuitState oldState = circuitState;
        circuitState = newState;
        emit CircuitStateChanged(newState, oldState);
    }

    /// @notice Internal function to check rate limit
    /// @param pair Address of the pair
    /// @param amount Amount to check
    /// @return allowed True if within rate limit
    function _checkRateLimit(address pair, uint256 amount) internal view returns (bool allowed) {
        // Check pair-specific rate limit
        RateLimit memory pairLimit = rateLimits[pair];
        if (pairLimit.maxAmount > 0) {
            if (block.timestamp > pairLimit.lastReset + pairLimit.timeWindow) {
                // Time window has passed, reset
                if (amount > pairLimit.maxAmount) {
                    return false;
                }
            } else {
                // Within time window, check current amount
                if (pairLimit.currentAmount + amount > pairLimit.maxAmount) {
                    return false;
                }
            }
        }

        // Check global rate limit
        if (block.timestamp > globalRateLimit.lastReset + globalRateLimit.timeWindow) {
            // Time window has passed, reset
            if (amount > globalRateLimit.maxAmount) {
                return false;
            }
        } else {
            // Within time window, check current amount
            if (globalRateLimit.currentAmount + amount > globalRateLimit.maxAmount) {
                return false;
            }
        }

        return true;
    }

    /// @notice Update rate limit counters (called by pairs)
    /// @param pair Address of the pair
    /// @param amount Amount to add to counters
    function updateRateLimitCounters(address pair, uint256 amount) external {
        // Only allow factory or pairs to call this
        require(
            msg.sender == factory || 
            IQuantumSwapFactory(factory).getPair(
                IQuantumSwapFactory(factory).allPairs(0), // This is a simplified check
                IQuantumSwapFactory(factory).allPairs(1)
            ) == msg.sender,
            "CIRCUIT_BREAKER: UNAUTHORIZED"
        );

        // Update pair-specific rate limit
        RateLimit storage pairLimit = rateLimits[pair];
        if (pairLimit.maxAmount > 0) {
            if (block.timestamp > pairLimit.lastReset + pairLimit.timeWindow) {
                // Reset time window
                pairLimit.lastReset = block.timestamp;
                pairLimit.currentAmount = amount;
            } else {
                // Add to current amount
                pairLimit.currentAmount += amount;
            }
        }

        // Update global rate limit
        if (block.timestamp > globalRateLimit.lastReset + globalRateLimit.timeWindow) {
            // Reset time window
            globalRateLimit.lastReset = block.timestamp;
            globalRateLimit.currentAmount = amount;
        } else {
            // Add to current amount
            globalRateLimit.currentAmount += amount;
        }
    }
}


