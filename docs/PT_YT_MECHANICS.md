# Pendle PT/YT Mechanics: Test Documentation

## Overview
This document explains the mechanics of Pendle's Principal Tokens (PT) and Yield Tokens (YT) through two test scenarios:
1. Basic PT/YT Separation Test (`08_test_pt_yt.ts`)
2. PT Pricing and Trading Test (`09_test_pt_pricing.ts`)

## Core Concepts

### 1. Token Components
- **SY (Standardized Yield) Token**: The base yield-bearing token
- **PT (Principal Token)**: Right to receive principal at maturity
- **YT (Yield Token)**: Right to receive yield until maturity

### 2. Maturity
- Fixed date when PTs become redeemable
- After maturity, PT+YT holders can redeem for underlying tokens
- Before maturity, tokens can be traded separately

### 3. Exchange Rate
- SY token's exchange rate increases as yield accrues
- YT holders benefit from exchange rate increases
- PT value converges to face value at maturity

## Test 1: Basic PT/YT Separation (`08_test_pt_yt.ts`)

### Test Flow
1. **Initial Setup**
   ```typescript
   Alice deposits 100 GNODE
   → Gets 100 PT + 100 YT
   ```

2. **Revenue Injection #1**
   ```typescript
   Inject 10 GNODE revenue
   Exchange rate: 1.0 → 1.1
   ```

3. **Bob's Entry**
   ```typescript
   Bob deposits 200 GNODE
   → Gets ~181.82 PT + YT (due to new exchange rate)
   ```

4. **Token Transfers**
   ```typescript
   Alice → Charlie: 100 YT (keeps PT)
   Bob → Charlie: 90.91 PT (keeps YT)
   ```

5. **Revenue Injection #2**
   ```typescript
   Inject 20 GNODE revenue
   Exchange rate: 1.1 → 1.17
   ```

### Final Positions
```
Alice:
- PT: 100
- YT: 0

Bob:
- PT: 90.91
- YT: 181.82

Charlie:
- PT: 90.91
- YT: 100
```

### Key Findings
1. **Redemption Requirements**
   - Must have equal amounts of PT and YT to redeem
   - Cannot redeem PT alone (Alice's error case)
   - Cannot redeem YT alone

2. **Yield Distribution**
   - YT holders capture all yield (exchange rate increases)
   - PT holders get fixed amount at maturity

## Test 2: PT Pricing Economics (`09_test_pt_pricing.ts`)

### Test Flow
1. **Initial Position**
   ```typescript
   Alice deposits 100 GNODE
   → Gets 100 PT + 100 YT
   Initial Value: 100 GNODE
   ```

2. **YT Sale**
   ```typescript
   Sells YT for 10 GNODE
   Keeps PT worth ~95 GNODE (market price)
   Current Value: 10 + 95 = 105 GNODE
   ```

3. **PT Price Appreciation**
   ```typescript
   After 90 days:
   PT price: 95 → 97 GNODE
   Sells PT for 97 GNODE
   Final Value: 10 + 97 = 107 GNODE
   ```

### Economics Breakdown
1. **Initial Trade**
   - YT Sale: +10 GNODE (upfront yield)
   - PT Discount: -5 GNODE (95 vs 100 face value)
   - Net Position: +5 GNODE

2. **PT Holding Period**
   - Price Appreciation: +2 GNODE (95 → 97)
   - Time Value: Natural convergence to face value

3. **Final P&L**
   - Total Profit: 7 GNODE
   - Sources: YT premium (10) + PT appreciation (2) - Principal discount (5)

## Trading Strategies

### 1. Fixed-Rate Strategy
```
- Sell YT immediately
- Hold PT to maturity
- Guaranteed return = (100 - PT market price) / PT market price
```

### 2. Yield Farming Strategy
```
- Buy YT only
- Leverage = Face Value / YT Price
- Return = Yield * Leverage - YT Premium
```

### 3. Basis Trading
```
- Buy PT when discount > fair value
- Sell PT when price > theoretical value
- Profit from convergence to face value
```

## Caveats and Risks

### 1. PT Holders
- **Market Risk**: Selling PT early may result in loss vs face value
- **Liquidity Risk**: May not find buyers at theoretical price
- **Interest Rate Risk**: PT price falls when rates rise

### 2. YT Holders
- **Yield Risk**: No guaranteed returns
- **Leverage Risk**: Can lose premium paid if yield is low
- **Duration Risk**: Value decreases as maturity approaches

### 3. System Risks
- **Smart Contract Risk**: Bugs in PT/YT mechanics
- **Market Making Risk**: Wide spreads in illiquid markets
- **Redemption Risk**: Need both PT+YT to redeem

## Best Practices

1. **For PT Traders**
   - Calculate implied yield before buying
   - Consider holding cost vs selling early
   - Monitor interest rate movements

2. **For YT Traders**
   - Understand leverage implied by YT price
   - Calculate break-even yield rate
   - Consider time decay of YT value

3. **For Market Makers**
   - Maintain PT/YT pair inventory
   - Price based on interest rates and time value
   - Consider correlation with underlying yield
