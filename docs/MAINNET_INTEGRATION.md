# Mainnet Integration Guide

This document outlines how to transition from our testnet implementation to Pendle's mainnet infrastructure, including SDK usage and contract interactions.

## Table of Contents
- [Architecture Differences](#architecture-differences)
- [Pendle SDK Integration](#pendle-sdk-integration)
- [Contract Interactions](#contract-interactions)
- [Migration Steps](#migration-steps)
- [Frontend Integration](#frontend-integration)

## Architecture Differences

### Testnet (Current)
```typescript
// Our custom implementation
const contracts = {
    gnodeToken: "0x...", // Our GNODE token
    sy: "0x...",        // Our SY implementation
    market: "0x...",    // Our mock market
    router: "0x...",    // Our mock router
    amm: "0x..."        // Our mock AMM
}
```

### Mainnet
```typescript
// Pendle's infrastructure
const PENDLE = {
    ROUTER: "0x0000....",         // Pendle Router
    MARKET_FACTORY: "0x0000....", // Market Factory
    SY_FACTORY: "0x0000....",    // SY Factory
    // Other Pendle core contracts
}
```

## Pendle SDK Integration

### Installation
```bash
npm install @pendle/sdk-v2
```

### Basic Setup
```typescript
import { PendleSDK, ChainId } from '@pendle/sdk-v2'

const sdk = new PendleSDK({
    chainId: ChainId.ARBITRUM,
    provider: yourProvider,
    signer: yourSigner
})
```

### Common Operations

1. **Fetching Market Data**
```typescript
// Get market info
const marketData = await sdk.getMarketData(marketAddress)

// Get user positions
const positions = await sdk.getUserPositions(userAddress)

// Get market APY
const apy = await sdk.getMarketApy(marketAddress)
```

2. **Trading Operations**
```typescript
// Swap tokens
const swapParams = {
    marketAddr: marketAddress,
    tokenIn: gnodeToken.address,
    tokenOut: ptAddress,
    amountIn: ethers.utils.parseEther("100"),
    minAmountOut: minAmountOut,
    deadline: deadline
}
const tx = await sdk.router.swap(swapParams)
```

3. **LP Operations**
```typescript
// Add liquidity
const addLiqParams = {
    marketAddr: marketAddress,
    baseIn: ethers.utils.parseEther("100"),
    ptIn: ethers.utils.parseEther("100"),
    minLp: minLpOut
}
const tx = await sdk.router.addLiquidity(addLiqParams)
```

## Contract Interactions

### 1. Market Creation
```typescript
// Testnet (our implementation)
await mockMarketFactory.createNewMarket(
    sy.address,
    expiry,
    initialAnchor
)

// Mainnet (Pendle's factory)
const marketParams = {
    SY: gnodeSY.address,
    expiry,
    interestRateModel: PENDLE.RATE_MODEL,
    feeRatio: PENDLE.DEFAULT_FEE,
    reserveFactor: PENDLE.DEFAULT_RESERVE
}
await pendleMarketFactory.createNewMarket(marketParams)
```

### 2. Minting PT/YT
```typescript
// Testnet
await mockRouter.mintPyFromSy(amount)

// Mainnet
await pendleRouter.mintPyFromSy({
    SY: gnodeSY.address,
    market: marketAddress,
    minPt: minPtOut,
    minYt: minYtOut,
    deadline: getDeadline()
})
```

### 3. Trading
```typescript
// Testnet
await mockAmm.swapExactBaseForPT(amountIn, minAmountOut)

// Mainnet
await pendleRouter.swapExactTokenForPt({
    market: marketAddress,
    tokenIn: gnodeToken.address,
    amountIn,
    minAmountOut,
    deadline,
    recipient: user.address
})
```

## Migration Steps

1. **Initial Setup**
```typescript
// Deploy only GNODE token
const gnodeToken = await deployGnodeToken()

// Use Pendle's SY Factory
const syParams = {
    yieldToken: gnodeToken.address,
    expiry: oneYearFromNow,
    // Pendle-specific params
}
const gnodeSY = await pendleSYFactory.createSY(syParams)
```

2. **Market Creation**
```typescript
const marketParams = {
    SY: gnodeSY.address,
    expiry: oneYearFromNow,
    interestRateModel: PENDLE.RATE_MODEL,
    feeRatio: PENDLE.DEFAULT_FEE,
    reserveFactor: PENDLE.DEFAULT_RESERVE
}
const market = await pendleMarketFactory.createNewMarket(marketParams)
```

3. **Initial Liquidity**
```typescript
// Approve tokens
await gnodeToken.approve(PENDLE.ROUTER, ethers.constants.MaxUint256)
await gnodeSY.approve(PENDLE.ROUTER, ethers.constants.MaxUint256)

// Add initial liquidity
const addLiquidityParams = {
    marketAddr: market.address,
    baseIn: initialBase,
    ptIn: initialPt,
    minLp: minLpOut
}
await sdk.router.addLiquidity(addLiquidityParams)
```

## Frontend Integration

### 1. SDK Configuration
```typescript
// config/pendle.ts
export const getPendleSDK = (provider: Provider, signer?: Signer) => {
    return new PendleSDK({
        chainId: ChainId.ARBITRUM,
        provider,
        signer
    })
}
```

### 2. Market Data Hooks
```typescript
// hooks/usePendleMarket.ts
export const usePendleMarket = (marketAddress: string) => {
    const sdk = usePendleSDK()
    const [marketData, setMarketData] = useState<MarketData>()

    useEffect(() => {
        const fetchData = async () => {
            const data = await sdk.getMarketData(marketAddress)
            setMarketData(data)
        }
        fetchData()
    }, [marketAddress])

    return marketData
}
```

### 3. Trading Functions
```typescript
// hooks/usePendleTrading.ts
export const usePendleTrading = () => {
    const sdk = usePendleSDK()

    const swapTokens = async (params: SwapParams) => {
        try {
            const tx = await sdk.router.swap(params)
            await tx.wait()
            return tx
        } catch (error) {
            console.error('Swap failed:', error)
            throw error
        }
    }

    return { swapTokens }
}
```

### 4. User Position Management
```typescript
// hooks/usePendlePositions.ts
export const usePendlePositions = (userAddress: string) => {
    const sdk = usePendleSDK()
    const [positions, setPositions] = useState<UserPositions>()

    useEffect(() => {
        const fetchPositions = async () => {
            const data = await sdk.getUserPositions(userAddress)
            setPositions(data)
        }
        fetchPositions()
    }, [userAddress])

    return positions
}
```

## Key Considerations

1. **Contract Verification**:
   - Testnet: We verify our contracts
   - Mainnet: Use Pendle's verified contracts

2. **Permissions**:
   - Testnet: We control all roles
   - Mainnet: Follow Pendle's permission system

3. **Fees**:
   - Testnet: Our simplified fee structure
   - Mainnet: Pendle's fee system (protocol fees, LP fees)

4. **Market Parameters**:
   - Testnet: Basic parameters
   - Mainnet: Must follow Pendle's market requirements

5. **SDK vs Direct Interaction**:
   - Prefer SDK for standard operations
   - Use direct contract calls for custom functionality

## Testing Strategy

1. **Local Testing**:
   - Use Hardhat fork of mainnet
   - Test against actual Pendle contracts
   - Simulate real market conditions

2. **Staging**:
   - Deploy to testnet first
   - Test with Pendle's testnet contracts
   - Verify all interactions work as expected

3. **Production**:
   - Thorough testing of all SDK interactions
   - Verify gas estimates and transaction flows
   - Test error handling and edge cases
