# Arbitrum Sepolia Deployment Guide

## Prerequisites
- Arbitrum Sepolia RPC URL
- Account with Arbitrum Sepolia ETH
- Private key in `.env` file

## Network Configuration
Already configured in hardhat.config.ts:
```typescript
arbitrumSepolia: {
    url: "https://sepolia-rollup.arbitrum.io/rpc",
    chainId: 421614,
    accounts: [process.env.PRIVATE_KEY]
}
```

## Deployment Steps

1. **Deploy Mock Pendle Infrastructure**
```bash
npx hardhat run scripts/10_deploy_pendle_core.ts --network arbitrumSepolia
```
This deploys:
- Mock Market Factory
- Mock Router

2. **Deploy GNODE System**
```bash
npx hardhat run scripts/11_deploy_gnode_system.ts --network arbitrumSepolia
```
This deploys:
- Mock GNODE Token
- Vault (upgradeable)
- SY Token
- Creates Market

3. **Deploy AMM System**
```bash
npx hardhat run scripts/12_deploy_amm.ts --network arbitrumSepolia
```
This deploys:
- AMM Factory
- PT/GNODE Pool
- YT/GNODE Pool
- PT/YT Pool

## Contract Addresses
After deployment, addresses are saved in `scripts/deployments.json`:
- `MockGnodeToken`
- `GnodeERC4626Vault`
- `PendleGnodeERC4626SY`
- `MockPendleMarketFactory`
- `MockPendleRouter`
- `GnodeMarket`
- `MockPendleAMMFactory`
- Pool addresses (PT/GNODE, YT/GNODE, PT/YT)

## Important Notes
1. **Maturity Period**: Set to 1 day for testing (instead of 1 year)
2. **Pool Types**:
   - PT/GNODE: For trading PT against GNODE
   - YT/GNODE: For trading YT against GNODE
   - PT/YT: For direct PT/YT swaps

3. **Liquidity**:
   - Each pool needs initial liquidity
   - Use different accounts for different pools to simulate real usage
   - Consider price ratios when adding liquidity

4. **Testing Flow**:
   - Deposit GNODE → Get SY
   - Mint PT/YT through Market
   - Trade in any pool
   - After maturity, redeem with matched PT/YT pairs

## Verification
For this test deployment, we're skipping contract verification to keep things simple.

## Troubleshooting
1. **Insufficient Balance**: Ensure deployer has enough ARB Sepolia ETH
2. **Failed Transactions**: Check gas limits and network congestion
3. **Pool Creation**: Ensure unique token pairs for each pool
4. **Market Creation**: Check expiry timestamp is in future