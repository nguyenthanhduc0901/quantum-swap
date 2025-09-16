import { ethers } from "hardhat";
import { readFileSync } from "fs";
import { join } from "path";

interface MonitoringConfig {
  factory: string;
  router: string;
  securityAudit: string;
  circuitBreaker: string;
  rpcUrl: string;
  alertWebhook?: string;
  checkInterval: number; // in seconds
}

interface PairMetrics {
  address: string;
  token0: string;
  token1: string;
  reserve0: string;
  reserve1: string;
  totalSupply: string;
  lastUpdate: number;
  price0Cumulative: string;
  price1Cumulative: string;
}

interface SecurityAlert {
  type: 'SUSPICIOUS_PAIR' | 'RATE_LIMIT_EXCEEDED' | 'EMERGENCY_STOP' | 'HIGH_PRICE_IMPACT';
  pair?: string;
  message: string;
  timestamp: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

class QuantumSwapMonitor {
  private config: MonitoringConfig;
  private factory: any;
  private securityAudit: any;
  private circuitBreaker: any;
  private isRunning: boolean = false;

  constructor(config: MonitoringConfig) {
    this.config = config;
  }

  async initialize() {
    console.log("🔧 Initializing QuantumSwap Monitor...");

    // Connect to contracts
    const factoryABI = await this.getContractABI("QuantumSwapFactory");
    const securityAuditABI = await this.getContractABI("SecurityAudit");
    const circuitBreakerABI = await this.getContractABI("CircuitBreaker");

    this.factory = new ethers.Contract(this.config.factory, factoryABI, ethers.provider);
    this.securityAudit = new ethers.Contract(this.config.securityAudit, securityAuditABI, ethers.provider);
    this.circuitBreaker = new ethers.Contract(this.config.circuitBreaker, circuitBreakerABI, ethers.provider);

    console.log("✅ Monitor initialized successfully");
  }

  async start() {
    if (this.isRunning) {
      console.log("⚠️ Monitor is already running");
      return;
    }

    this.isRunning = true;
    console.log("🚀 Starting QuantumSwap Monitor...");
    console.log(`📊 Check interval: ${this.config.checkInterval} seconds`);

    // Start monitoring loop
    this.monitoringLoop();
  }

  async stop() {
    this.isRunning = false;
    console.log("🛑 Monitor stopped");
  }

  private async monitoringLoop() {
    while (this.isRunning) {
      try {
        await this.performHealthCheck();
        await this.checkAllPairs();
        await this.checkSecurityStatus();
        await this.checkCircuitBreakerStatus();
        
        console.log(`✅ Health check completed at ${new Date().toISOString()}`);
      } catch (error) {
        console.error("❌ Error during health check:", error);
        await this.sendAlert({
          type: 'EMERGENCY_STOP',
          message: `Monitor error: ${error}`,
          timestamp: Date.now(),
          severity: 'HIGH'
        });
      }

      // Wait for next check
      await new Promise(resolve => setTimeout(resolve, this.config.checkInterval * 1000));
    }
  }

  private async performHealthCheck() {
    console.log("🔍 Performing health check...");

    // Check if contracts are accessible
    try {
      await this.factory.allPairsLength();
      await this.securityAudit.auditor();
      await this.circuitBreaker.circuitState();
    } catch (error) {
      throw new Error(`Contract accessibility check failed: ${error}`);
    }

    // Check network connectivity
    try {
      const blockNumber = await ethers.provider.getBlockNumber();
      console.log(`📦 Current block: ${blockNumber}`);
    } catch (error) {
      throw new Error(`Network connectivity check failed: ${error}`);
    }
  }

  private async checkAllPairs() {
    console.log("🔍 Checking all pairs...");

    try {
      const pairCount = await this.factory.allPairsLength();
      console.log(`📊 Total pairs: ${pairCount.toString()}`);

      for (let i = 0; i < Math.min(Number(pairCount), 10); i++) { // Check first 10 pairs
        const pairAddress = await this.factory.allPairs(i);
        await this.checkPairHealth(pairAddress);
      }
    } catch (error) {
      console.error("❌ Error checking pairs:", error);
    }
  }

  private async checkPairHealth(pairAddress: string) {
    try {
      // Get pair metrics
      const metrics = await this.getPairMetrics(pairAddress);
      
      // Check for suspicious activity
      const [isSuspicious, reason] = await this.securityAudit.checkPairSecurity(pairAddress);
      
      if (isSuspicious) {
        await this.sendAlert({
          type: 'SUSPICIOUS_PAIR',
          pair: pairAddress,
          message: `Suspicious pair detected: ${reason}`,
          timestamp: Date.now(),
          severity: 'MEDIUM'
        });
      }

      // Check for extreme price changes
      const timeSinceUpdate = Date.now() / 1000 - metrics.lastUpdate;
      if (timeSinceUpdate > 3600) { // 1 hour
        await this.sendAlert({
          type: 'SUSPICIOUS_PAIR',
          pair: pairAddress,
          message: `Pair not updated for ${Math.floor(timeSinceUpdate / 3600)} hours`,
          timestamp: Date.now(),
          severity: 'LOW'
        });
      }

      // Check for very low liquidity
      const reserve0 = parseFloat(ethers.formatEther(metrics.reserve0));
      const reserve1 = parseFloat(ethers.formatEther(metrics.reserve1));
      
      if (reserve0 < 1 || reserve1 < 1) {
        await this.sendAlert({
          type: 'SUSPICIOUS_PAIR',
          pair: pairAddress,
          message: `Low liquidity detected: ${reserve0.toFixed(2)} / ${reserve1.toFixed(2)}`,
          timestamp: Date.now(),
          severity: 'LOW'
        });
      }

    } catch (error) {
      console.error(`❌ Error checking pair ${pairAddress}:`, error);
    }
  }

  private async getPairMetrics(pairAddress: string): Promise<PairMetrics> {
    const pairABI = await this.getContractABI("QuantumSwapPair");
    const pair = new ethers.Contract(pairAddress, pairABI, ethers.provider);

    const [token0, token1, reserves, totalSupply, price0Cumulative, price1Cumulative] = await Promise.all([
      pair.token0(),
      pair.token1(),
      pair.getReserves(),
      pair.totalSupply(),
      pair.price0CumulativeLast(),
      pair.price1CumulativeLast()
    ]);

    return {
      address: pairAddress,
      token0,
      token1,
      reserve0: reserves[0].toString(),
      reserve1: reserves[1].toString(),
      totalSupply: totalSupply.toString(),
      lastUpdate: Number(reserves[2]),
      price0Cumulative: price0Cumulative.toString(),
      price1Cumulative: price1Cumulative.toString()
    };
  }

  private async checkSecurityStatus() {
    console.log("🔍 Checking security status...");

    try {
      const [isSecure, issues] = await this.securityAudit.checkFactorySecurity();
      
      if (!isSecure) {
        await this.sendAlert({
          type: 'SUSPICIOUS_PAIR',
          message: `Factory security issues: ${issues.join(", ")}`,
          timestamp: Date.now(),
          severity: 'HIGH'
        });
      }
    } catch (error) {
      console.error("❌ Error checking security status:", error);
    }
  }

  private async checkCircuitBreakerStatus() {
    console.log("🔍 Checking circuit breaker status...");

    try {
      const circuitState = await this.circuitBreaker.circuitState();
      const emergencyStopped = await this.circuitBreaker.emergencyStopped();

      if (emergencyStopped) {
        await this.sendAlert({
          type: 'EMERGENCY_STOP',
          message: "System is in emergency stop state",
          timestamp: Date.now(),
          severity: 'CRITICAL'
        });
      }

      if (circuitState === 2) { // Emergency state
        await this.sendAlert({
          type: 'EMERGENCY_STOP',
          message: "Circuit breaker is in emergency state",
          timestamp: Date.now(),
          severity: 'CRITICAL'
        });
      }
    } catch (error) {
      console.error("❌ Error checking circuit breaker status:", error);
    }
  }

  private async sendAlert(alert: SecurityAlert) {
    console.log(`🚨 ALERT [${alert.severity}]: ${alert.message}`);
    
    if (this.config.alertWebhook) {
      try {
        // Send to webhook (Slack, Discord, etc.)
        const response = await fetch(this.config.alertWebhook, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: `🚨 QuantumSwap Alert [${alert.severity}]: ${alert.message}`,
            timestamp: new Date(alert.timestamp).toISOString(),
            pair: alert.pair,
            type: alert.type
          })
        });

        if (!response.ok) {
          console.error("❌ Failed to send alert to webhook");
        }
      } catch (error) {
        console.error("❌ Error sending alert:", error);
      }
    }
  }

  private async getContractABI(contractName: string): Promise<any[]> {
    try {
      const artifactPath = join(__dirname, `../artifacts/contracts/core/${contractName}.sol/${contractName}.json`);
      const artifact = JSON.parse(readFileSync(artifactPath, 'utf8'));
      return artifact.abi;
    } catch (error) {
      // Fallback to hardhat compilation
      const contract = await ethers.getContractFactory(contractName);
      return contract.interface.format();
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command) {
    console.log("Usage: npm run monitor [start|stop|status]");
    process.exit(1);
  }

  // Load configuration
  const configPath = join(__dirname, "../config.monitor.json");
  let config: MonitoringConfig;

  try {
    config = JSON.parse(readFileSync(configPath, 'utf8'));
  } catch (error) {
    console.error("❌ Failed to load monitor configuration");
    console.log("Please create config.monitor.json with your deployment addresses");
    process.exit(1);
  }

  const monitor = new QuantumSwapMonitor(config);
  await monitor.initialize();

  switch (command) {
    case 'start':
      await monitor.start();
      break;
    case 'stop':
      await monitor.stop();
      break;
    case 'status':
      console.log("📊 Monitor status: Running");
      break;
    default:
      console.log("Unknown command. Use: start, stop, or status");
      process.exit(1);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

export { QuantumSwapMonitor };
