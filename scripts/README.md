# QuantumSwap Scripts

This directory contains all deployment and initialization scripts for QuantumSwap.

## 📁 Scripts Overview

| Script | Purpose | Usage | Network |
|--------|---------|-------|---------|
| `init-complete.ts` | **Complete development setup** | `npx hardhat run scripts/init-complete.ts --network localhost` | Localhost |
| `deploy-production.ts` | **Production deployment** | `npx hardhat run scripts/deploy-production.ts --network <network>` | Mainnet/Testnet |
| `monitor.ts` | **Contract monitoring** | `npx hardhat run scripts/monitor.ts --network <network>` | Any |

## 🚀 Quick Start

### Development Setup (Recommended)
For local development with full initialization:

```bash
# Start Hardhat node (in one terminal)
npx hardhat node --port 8545

# Complete initialization (in another terminal)
npx hardhat run scripts/init-complete.ts --network localhost
```

This will:
- Deploy all contracts (Factory, Router, WETH)
- Deploy 8 tokens (WETH, DAI, USDC, USDT, LINK, UNI, AAVE, WBTC)
- Create 10 trading pools with liquidity
- Generate frontend constants automatically
- Ready for frontend development

### Production Deployment
For production deployment:

```bash
# Deploy to specified network
npx hardhat run scripts/deploy-production.ts --network <network-name>
```

This will:
- Deploy all contracts with verification
- Save deployment data
- Generate frontend constants
- Provide next steps guidance

## 📋 Script Details

### `init-complete.ts`
**Complete TypeScript initialization script (recommended for development).**

**Features:**
- Deploy contracts + tokens + pools in one script
- Create 10 pools with liquidity
- Auto-generate frontend constants
- TypeScript with better error handling
- Comprehensive logging and progress tracking

**Creates 10 pools:**
- WETH/USDC (100 WETH / 200K USDC)
- WETH/DAI (50 WETH / 100K DAI)
- USDC/USDT (100K USDC / 100K USDT)
- LINK/WETH (1K LINK / 10 WETH)
- UNI/WETH (500 UNI / 5 WETH)
- AAVE/WETH (100 AAVE / 2 WETH)
- DAI/USDC (50K DAI / 50K USDC)
- LINK/USDC (500 LINK / 10K USDC)
- UNI/USDC (200 UNI / 5K USDC)
- WBTC/WETH (10 WBTC / 200 WETH)

**Usage:**
```bash
npx hardhat run scripts/init-complete.ts --network localhost
```

### `deploy-production.ts`
**Production deployment script with verification.**

**Features:**
- Deploy all core contracts
- Automatic contract verification on Etherscan
- Save deployment data to files
- Generate frontend constants
- Production-ready error handling
- Network-specific configurations

**Deploys:**
- QuantumSwapFactory
- WETH (or use canonical on mainnet)
- QuantumSwapRouter
- SecurityAudit

**Usage:**
```bash
# Deploy to Sepolia testnet
npx hardhat run scripts/deploy-production.ts --network sepolia

# Deploy to mainnet
npx hardhat run scripts/deploy-production.ts --network mainnet
```

### `monitor.ts`
**Contract monitoring and health checking.**

**Features:**
- Real-time contract health monitoring
- Security alert system
- Pair liquidity monitoring
- Circuit breaker status checking
- Webhook integration for alerts
- Comprehensive logging

**Usage:**
```bash
# Start monitoring
npx hardhat run scripts/monitor.ts start --network <network>

# Check status
npx hardhat run scripts/monitor.ts status --network <network>

# Stop monitoring
npx hardhat run scripts/monitor.ts stop --network <network>
```

## 🪙 Supported Tokens

- **WETH**: Wrapped Ether (18 decimals)
- **DAI**: Dai Stablecoin (18 decimals)
- **USDC**: USD Coin (6 decimals)
- **USDT**: Tether USD (6 decimals)
- **LINK**: ChainLink Token (18 decimals)
- **UNI**: Uniswap Token (18 decimals)
- **AAVE**: Aave Token (18 decimals)
- **WBTC**: Wrapped Bitcoin (8 decimals)

## 🔧 Configuration

### Environment Variables
Create a `.env` file in the QuantumSwap root directory:

```env
# Network Configuration
PRIVATE_KEY=your_private_key_here
INFURA_API_KEY=your_infura_key_here
ETHERSCAN_API_KEY=your_etherscan_key_here

# Monitoring (optional)
ALERT_WEBHOOK_URL=your_webhook_url_here
```

### Network Configuration
Update `hardhat.config.ts` with your network configurations:

```typescript
networks: {
  localhost: {
    url: "http://127.0.0.1:8545"
  },
  sepolia: {
    url: `https://sepolia.infura.io/v3/${INFURA_API_KEY}`,
    accounts: [PRIVATE_KEY]
  },
  mainnet: {
    url: `https://mainnet.infura.io/v3/${INFURA_API_KEY}`,
    accounts: [PRIVATE_KEY]
  }
}
```

## 📊 Output Files

### Development (`init-complete.ts`)
- `frontend/src/constants/generated/addresses.local.json` - Frontend constants

### Production (`deploy-production.ts`)
- `deployments/<network>-<timestamp>.json` - Deployment data
- `frontend/src/constants/generated/addresses.<network>.json` - Frontend constants

### Monitoring (`monitor.ts`)
- Console logs with health status
- Webhook alerts (if configured)

## 🚨 Troubleshooting

### Common Issues

**1. "Contract already deployed" error**
```bash
# Solution: Use different network or reset
npx hardhat clean
npx hardhat compile
```

**2. "Insufficient funds" error**
```bash
# Solution: Check account balance
npx hardhat run scripts/init-complete.ts --network localhost --dry-run
```

**3. "Network not found" error**
```bash
# Solution: Check hardhat.config.ts network configuration
npx hardhat console --network localhost
```

**4. Frontend constants not updated**
```bash
# Solution: Check file permissions and paths
ls -la frontend/src/constants/generated/
```

### Debug Mode
Run scripts with verbose logging:

```bash
# Enable debug mode
DEBUG=hardhat* npx hardhat run scripts/init-complete.ts --network localhost
```

## 🔗 Integration

### Frontend Integration
After running `init-complete.ts`, the frontend will automatically have:
- Contract addresses
- Token configurations
- Pool information
- Network settings

### CI/CD Integration
For automated deployments:

```yaml
# GitHub Actions example
- name: Deploy to Sepolia
  run: npx hardhat run scripts/deploy-production.ts --network sepolia
  env:
    PRIVATE_KEY: ${{ secrets.PRIVATE_KEY }}
    INFURA_API_KEY: ${{ secrets.INFURA_API_KEY }}
    ETHERSCAN_API_KEY: ${{ secrets.ETHERSCAN_API_KEY }}
```

## 📚 Additional Resources

- [Hardhat Documentation](https://hardhat.org/docs)
- [Ethers.js Documentation](https://docs.ethers.org/)
- [QuantumSwap Main README](../README.md)
- [Frontend Documentation](../../frontend/README.md)

## 🤝 Contributing

When adding new scripts:
1. Follow the existing naming convention
2. Add comprehensive error handling
3. Include progress logging
4. Update this README
5. Test on localhost first

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](../LICENSE) file for details.