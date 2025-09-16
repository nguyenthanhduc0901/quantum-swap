# QuantumSwap

A high-performance Automated Market Maker (AMM) decentralized exchange inspired by Uniswap V2, built with gas optimization and modern Solidity practices.

## 🚀 Features

- **Constant Product AMM**: Implements x * y = k pricing model for efficient price discovery
- **Gas Optimized**: Built with gas efficiency in mind using modern Solidity patterns
- **CREATE2 Deployment**: Deterministic pair addresses for better UX
- **Flash Swaps**: Support for flash loan functionality
- **Protocol Fees**: Configurable protocol fee system
- **WETH Integration**: Native ETH support through WETH wrapping

## 📁 Project Structure

```
QuantumSwap/
├── contracts/
│   ├── core/                    # Core protocol contracts
│   │   ├── QuantumSwapFactory.sol    # Factory for creating pairs
│   │   └── QuantumSwapPair.sol       # AMM pair implementation
│   ├── peripherals/             # Peripheral contracts
│   │   └── QuantumSwapRouter.sol     # Router for swaps and liquidity
│   ├── tokens/                  # Token implementations
│   │   ├── ERC20.sol                # Standard ERC20 implementation
│   │   ├── MockERC20.sol            # Mock tokens for testing
│   │   └── WETH.sol                 # Wrapped ETH implementation
│   └── libs/                    # Utility libraries
│       ├── Math.sol                 # Mathematical utilities
│       └── UQ112x112.sol           # Fixed-point arithmetic
├── interfaces/                  # Contract interfaces
│   ├── IERC20.sol
│   ├── IQuantumSwapFactory.sol
│   ├── IQuantumSwapPair.sol
│   └── IQuantumSwapRouter.sol
├── scripts/                     # Deployment scripts
│   ├── deploy.ts                    # Main deployment script
│   ├── deploy-local.ts              # Local deployment
│   └── placeholder.script.ts        # Placeholder script
├── test/                        # Test suites
│   ├── QuantumSwap.test.ts          # Main protocol tests
│   └── placeholder.test.ts          # Placeholder tests
└── artifacts/                   # Compiled contracts
```

## 🛠️ Core Contracts

### QuantumSwapFactory
- **Purpose**: Creates and manages liquidity pairs
- **Key Features**:
  - CREATE2 deployment for deterministic addresses
  - Protocol fee management
  - Pair tracking and enumeration
- **Functions**:
  - `createPair(tokenA, tokenB)`: Creates a new trading pair
  - `getPair(tokenA, tokenB)`: Returns pair address
  - `allPairsLength()`: Returns total number of pairs

### QuantumSwapPair
- **Purpose**: Core AMM implementation for token pairs
- **Key Features**:
  - Constant product formula (x * y = k)
  - LP token minting/burning
  - Flash swap support
  - Price oracle functionality
- **Functions**:
  - `mint(to)`: Mints LP tokens for liquidity providers
  - `burn(to)`: Burns LP tokens and returns underlying assets
  - `swap()`: Executes token swaps
  - `sync()`: Updates reserves

### QuantumSwapRouter
- **Purpose**: User-friendly interface for interacting with pairs
- **Key Features**:
  - Add/remove liquidity with optimal ratios
  - Multi-hop swaps
  - ETH support through WETH
  - Slippage protection
- **Functions**:
  - `addLiquidity()`: Adds liquidity to a pair
  - `removeLiquidity()`: Removes liquidity from a pair
  - `swapExactTokensForTokens()`: Exact input swaps
  - `swapTokensForExactTokens()`: Exact output swaps

## 🧪 Testing

The project includes comprehensive test coverage:

```bash
# Run all tests
npm test

# Run specific test file
npx hardhat test test/QuantumSwap.test.ts
```

### Test Coverage
- Factory deployment and pair creation
- Liquidity provision and removal
- Token swaps (exact input/output)
- Flash swaps
- Edge cases and error conditions
- Gas optimization verification

## 🚀 Deployment

### Local Development
```bash
# Start local Hardhat node
npm run node

# Deploy to local network
npx hardhat run scripts/deploy-local.ts --network localhost
```

### Mainnet/Testnet Deployment
```bash
# Deploy to specified network
npx hardhat run scripts/deploy.ts --network <network-name>
```

### Deployment Order
1. **QuantumSwapFactory**: Deploy factory contract
2. **WETH**: Deploy wrapped ETH contract
3. **QuantumSwapRouter**: Deploy router with factory and WETH addresses

## 📊 Key Metrics

- **Gas Efficiency**: Optimized for minimal gas consumption
- **Security**: Audited code patterns and comprehensive testing
- **Compatibility**: Full ERC20 and Uniswap V2 interface compatibility
- **Scalability**: Supports unlimited token pairs

## 🔧 Configuration

### Hardhat Configuration
- **Solidity Version**: 0.8.20
- **Optimizer**: Enabled (200 runs)
- **Default Network**: Hardhat local network

### Environment Variables
Create a `.env` file for network configuration:
```env
PRIVATE_KEY=your_private_key
RPC_URL=your_rpc_url
ETHERSCAN_API_KEY=your_etherscan_key
```

## 📚 Dependencies

- **Hardhat**: Development framework
- **OpenZeppelin**: Security-focused contract library
- **Solmate**: Gas-optimized contract library
- **TypeScript**: Type-safe development

## 🔒 Security Considerations

- **Reentrancy Protection**: All external calls are protected
- **Integer Overflow**: Solidity 0.8+ built-in protection
- **Access Control**: Proper permission management
- **Input Validation**: Comprehensive parameter checking

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🔗 Related Projects

- **Frontend**: React-based DEX interface (see `/frontend` directory)
- **Documentation**: Comprehensive API documentation
- **Analytics**: Trading analytics and metrics

---

Built with ❤️ for the decentralized future