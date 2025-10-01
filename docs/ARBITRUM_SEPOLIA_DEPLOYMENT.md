# Arbitrum Sepolia Deployment Checklist

## Pre-Deployment Setup

### 1. Environment Configuration
- [ ] Add Arbitrum Sepolia network to `hardhat.config.ts`:
  ```typescript
  networks: {
    arbitrumSepolia: {
      url: "https://sepolia-rollup.arbitrum.io/rpc",
      chainId: 421614,
      accounts: [process.env.PRIVATE_KEY]
    }
  }
  ```
- [ ] Set up `.env` file:
  ```
  PRIVATE_KEY=your_deployer_private_key
  ARBITRUM_SEPOLIA_RPC=https://sepolia-rollup.arbitrum.io/rpc
  ```
- [ ] Get some ETH from Arbitrum Sepolia faucet

### 2. Contract Verification Setup
- [ ] Add verification plugins to `hardhat.config.ts`:
  ```typescript
  require("@nomiclabs/hardhat-etherscan");
  ```
- [ ] Get Arbiscan API key for verification
- [ ] Add to `.env`:
  ```
  ARBISCAN_API_KEY=your_arbiscan_api_key
  ```

## Deployment Steps

### 1. Deploy Mock GNODE Token
- [ ] Deploy `MockGnodeToken`
- [ ] Verify on Arbiscan
- [ ] Save address to deployment records
- [ ] Mint initial supply to deployer

### 2. Deploy Vault
- [ ] Deploy `GnodeERC4626Vault` as UUPS proxy
- [ ] Set up roles:
  - REVENUE_MANAGER_ROLE
  - PAUSER_ROLE
  - EMERGENCY_ROLE
- [ ] Verify implementation and proxy
- [ ] Save addresses

### 3. Deploy SY Token
- [ ] Deploy `PendleGnodeERC4626SY`
- [ ] Initialize with vault address
- [ ] Verify contract
- [ ] Save address

### 4. Pendle Integration

#### 4a. Get Pendle Contract Addresses
- [ ] Market Factory
- [ ] Router
- [ ] VotingController
- [ ] PendleToken (for liquidity incentives)

#### 4b. Create Market
- [ ] Approve SY token for Market Factory
- [ ] Call Market Factory to create PT/YT market:
  ```typescript
  await marketFactory.createNewMarket(
    syAddress,
    expiry,
    initialAnchor
  );
  ```
- [ ] Save market address

#### 4c. Router Setup
- [ ] Approve SY token for Router
- [ ] Approve underlying token for SY token

## Post-Deployment Steps

### 1. Market Making Setup
- [ ] Add initial liquidity to PT market
- [ ] Set up price feeds if needed
- [ ] Configure any AMM parameters

### 2. Testing on Testnet

#### Basic Operations
- [ ] Test GNODE minting
- [ ] Test vault deposits
- [ ] Test SY minting
- [ ] Test PT/YT creation

#### Market Operations
- [ ] Test PT trades
- [ ] Test YT transfers
- [ ] Test revenue injection
- [ ] Test exchange rate updates

#### Integration Tests
- [ ] Test with Pendle Router
- [ ] Test with Market Factory
- [ ] Test with other Pendle contracts

### 3. Verification Steps
- [ ] Verify all contract source code
- [ ] Verify proxy implementations
- [ ] Verify contract ownership
- [ ] Verify role assignments

## Contract Addresses Template

```markdown
# Arbitrum Sepolia Deployment Addresses

## Core Contracts
- GNODE Token: `0x...`
- Vault Implementation: `0x...`
- Vault Proxy: `0x...`
- SY Token: `0x...`

## Pendle Contracts
- Market Factory: `0x...`
- Router: `0x...`
- Market: `0x...`

## Roles
- Revenue Manager: `0x...`
- Emergency Admin: `0x...`
- Pauser: `0x...`
```

## Deployment Scripts

### 1. Update Scripts
- [ ] Modify `scripts/07_fresh_deploy_with_market.ts` for Arbitrum Sepolia:
  ```typescript
  // Add Pendle contract addresses
  const PENDLE_MARKET_FACTORY = "0x...";
  const PENDLE_ROUTER = "0x...";
  ```

### 2. Create Verification Script
- [ ] Create `scripts/10_verify_contracts.ts`:
  ```typescript
  async function main() {
    // Verify each contract
    await hre.run("verify:verify", {
      address: "contract_address",
      constructorArguments: []
    });
  }
  ```

## Emergency Procedures

### 1. Setup Emergency Controls
- [ ] Test pause functionality
- [ ] Test emergency withdrawal
- [ ] Document emergency procedures

### 2. Create Emergency Scripts
- [ ] Pause script
- [ ] Emergency withdrawal script
- [ ] Role transfer script

## Documentation Updates

### 1. Update Deployment Records
- [ ] Create deployment log with all addresses
- [ ] Document all contract parameters
- [ ] Record all role assignments

### 2. Update Integration Docs
- [ ] Document Pendle integration points
- [ ] Update market creation parameters
- [ ] Document trading procedures

## Final Checklist

### 1. Contract Verification
- [ ] All contracts verified on Arbiscan
- [ ] All proxies verified
- [ ] All roles correctly assigned

### 2. Functionality Verification
- [ ] Basic operations working
- [ ] Market creation successful
- [ ] PT/YT trading working
- [ ] Revenue injection working

### 3. Documentation
- [ ] All addresses documented
- [ ] All parameters recorded
- [ ] Integration points documented
- [ ] Emergency procedures documented
