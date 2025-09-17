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
├── scripts/                     # Deployment and initialization scripts
│   ├── deploy.ts                    # Main deployment script
│   ├── deploy-local.ts              # Local deployment
│   ├── deploy-production.ts         # Production deployment
│   ├── init-all.js                  # Master initialization script
│   ├── init-pools.js                # Create multiple pools with liquidity
│   ├── update-frontend-constants.js # Update frontend constants
│   ├── monitor.ts                   # Contract monitoring script
│   └── README.md                    # Scripts documentation
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

## 🚀 Quick Start

### One-Command Setup (Recommended)
For frontend development, run the complete initialization script:

```bash
# Start Hardhat node (in one terminal)
npm run node

# Initialize everything (in another terminal)
npm run init
```

This will:
1. Deploy all contracts (Factory, Router, WETH)
2. Deploy 8 tokens (WETH, DAI, USDC, USDT, LINK, UNI, AAVE, WBTC)
3. Create 10 trading pools with liquidity
4. Generate frontend constants automatically
5. Ready for frontend development

### Production Deployment
```bash
# Deploy to Sepolia testnet
npm run deploy:sepolia

# Deploy to mainnet
npm run deploy:mainnet
```

### Available Scripts

- **`init-complete.ts`**: Complete TypeScript initialization (recommended for development)
- **`deploy-production.ts`**: Production deployment with verification
- **`monitor.ts`**: Contract monitoring and health checking

### Deployment Order
1. **QuantumSwapFactory**: Deploy factory contract
2. **WETH**: Deploy wrapped ETH contract  
3. **QuantumSwapRouter**: Deploy router with factory and WETH addresses
4. **Pools**: Create trading pairs with initial liquidity
5. **Frontend**: Update constants for frontend integration

## 🏊 Created Pools

After running `init-complete.ts`, the following pools will be created with liquidity:

| Pool | Token A | Token B | Liquidity A | Liquidity B |
|------|---------|---------|-------------|-------------|
| WETH/USDC | WETH | USDC | 100 WETH | 200,000 USDC |
| WETH/DAI | WETH | DAI | 50 WETH | 100,000 DAI |
| USDC/USDT | USDC | USDT | 100,000 USDC | 100,000 USDT |
| LINK/WETH | LINK | WETH | 1,000 LINK | 10 WETH |
| UNI/WETH | UNI | WETH | 500 UNI | 5 WETH |
| AAVE/WETH | AAVE | WETH | 100 AAVE | 2 WETH |
| DAI/USDC | DAI | USDC | 50,000 DAI | 50,000 USDC |
| LINK/USDC | LINK | USDC | 500 LINK | 10,000 USDC |
| UNI/USDC | UNI | USDC | 200 UNI | 5,000 USDC |
| WBTC/WETH | WBTC | WETH | 10 WBTC | 200 WETH |

## 🪙 Supported Tokens

- **WETH**: Wrapped Ether (18 decimals)
- **DAI**: Dai Stablecoin (18 decimals)
- **USDC**: USD Coin (6 decimals)
- **USDT**: Tether USD (6 decimals)
- **LINK**: ChainLink Token (18 decimals)
- **UNI**: Uniswap Token (18 decimals)
- **AAVE**: Aave Token (18 decimals)
- **WBTC**: Wrapped Bitcoin (8 decimals)

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

## 🛠️ Development Workflow

### Frontend Development
1. Start Hardhat node: `npx hardhat node --port 8545`
2. Initialize pools: `node scripts/init-all.js`
3. Start frontend: `cd ../frontend && npm run dev`
4. Connect wallet to localhost:8545 (Chain ID: 31337)

### Testing New Features
1. Run tests: `npm test`
2. Deploy to local: `npx hardhat run scripts/deploy.ts --network localhost`
3. Test with frontend or scripts

### Adding New Pools
1. Modify `scripts/init-pools.js`
2. Add new token deployment
3. Add pool configuration
4. Update `scripts/update-frontend-constants.js`
5. Run `node scripts/init-all.js`

## 🚨 Troubleshooting

### Common Issues

**Insufficient Funds Error**
```bash
# Reduce amounts in init-pools.js
# Decrease WETH amounts or token mint amounts
```

**Contract Already Deployed**
```bash
# Skip deployment, just create pools
npx hardhat run scripts/init-pools.js --network localhost
node scripts/update-frontend-constants.js
```

**Frontend Not Updated**
```bash
# Manually update constants
node scripts/update-frontend-constants.js
```

**Port Already in Use**
```bash
# Use different port
npx hardhat node --port 8546
# Update network config accordingly
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

## 📋 Scripts Reference

| Script | Purpose | Usage |
|--------|---------|-------|
| `init-complete.ts` | Complete development setup | `npm run init` |
| `deploy-production.ts` | Production deployment | `npm run deploy:sepolia` / `npm run deploy:mainnet` |
| `monitor.ts` | Contract monitoring | `npm run monitor:start` |

## 🔗 Related Projects

- **Frontend**: React-based DEX interface (see `/frontend` directory)
- **Scripts**: Comprehensive initialization and deployment scripts
- **Documentation**: Detailed API and usage documentation

## 📞 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the scripts documentation in `/scripts/README.md`
3. Check test files for usage examples

---

Built with ❤️ for the decentralized future