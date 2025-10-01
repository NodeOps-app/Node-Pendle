# GNODE Frontend User Experience Flow

## 1. Market Overview

### Available Markets Display
```
Current Active Markets:
├── June 2024 Market
│   ├── Expiry: June 30, 2024 00:00 UTC
│   ├── Time Left: 120 days
│   ├── Total Deposits: 500K GNODE
│   └── Current Exchange Rate: 1 SY = 1.02 GNODE
│
├── September 2024 Market
│   ├── Expiry: September 30, 2024 00:00 UTC
│   ├── Time Left: 210 days
│   ├── Total Deposits: 300K GNODE
│   └── Current Exchange Rate: 1 SY = 1.02 GNODE
│
└── December 2024 Market
    ├── Expiry: December 31, 2024 00:00 UTC
    ├── Time Left: 300 days
    ├── Total Deposits: 200K GNODE
    └── Current Exchange Rate: 1 SY = 1.02 GNODE
```

## 2. User Actions

### A. Deposit Flow
1. **Select Market**
   ```
   Choose Market:
   ├── June 2024 (Expires in 120 days)
   ├── September 2024 (Expires in 210 days)
   └── December 2024 (Expires in 300 days)
   ```

2. **Deposit GNODE**
   ```
   Input: 1000 GNODE
   Preview:
   ├── SY Tokens: 1000 SY-GNODE
   ├── PT Tokens: 1000 PT
   ├── YT Tokens: 1000 YT
   └── Market: June 2024
   ```

3. **Choose Strategy**
   ```
   Options:
   ├── Hold Both (PT + YT)
   │   └── Redeem full amount at maturity
   │
   ├── Sell YT, Keep PT
   │   ├── Get immediate yield
   │   └── Guaranteed GNODE at maturity
   │
   ├── Sell PT, Keep YT
   │   ├── Lower capital requirement
   │   └── Higher yield exposure
   │
   └── Provide Liquidity
       ├── PT/GNODE Pool
       └── YT/GNODE Pool
   ```

### B. Trading Interface
```
Available Pairs:
├── PT/GNODE
│   └── Trade principal tokens
│
├── YT/GNODE
│   └── Trade yield tokens
│
└── PT/YT
    └── Trade between principal and yield
```

### C. Portfolio View
```
Active Positions:
├── June 2024 Market
│   ├── 500 PT + 500 YT (Matched)
│   ├── 200 PT (Unmatched)
│   └── Expires: June 30, 2024
│
└── September 2024 Market
    ├── 300 YT (Unmatched)
    └── Expires: September 30, 2024

LP Positions:
├── PT/GNODE Pool (June 2024)
│   ├── LP Tokens: 100
│   └── Share: 2% of pool
│
└── YT/GNODE Pool (June 2024)
    ├── LP Tokens: 50
    └── Share: 1% of pool
```

## 3. Maturity Handling

### A. Pre-Maturity
```
For June 2024 Market:
├── Warning Banner (7 days before)
├── Options Shown:
│   ├── Match PT/YT if unmatched
│   ├── Trade to exit position
│   └── Prepare for redemption
└── Countdown timer
```

### B. At Maturity
```
Matured Position (June 2024):
├── Matched PT + YT
│   └── "Redeem" button active
│   └── Get back GNODE directly
│
├── Unmatched PT
│   └── Need to buy matching YT
│   └── Then can redeem
│
└── Unmatched YT
    └── Need to buy matching PT
    └── Then can redeem
```

### C. Post-Maturity
```
Expired Market View:
├── Matched Positions
│   └── Redeemable for GNODE
│
└── Unmatched Positions
    ├── Must match PT/YT first
    └── Then redeem for GNODE
```

## 4. Important Displays

### A. Market Stats
```
For Each Market:
├── Time to Expiry
├── Total Value Locked
├── Trading Volume (24h)
└── Current Rates:
    ├── PT Price in GNODE
    ├── YT Price in GNODE
    └── PT/YT Ratio
```

### B. User Position Summary
```
Quick View:
├── Total Value Locked
├── Positions by Market
├── Matched vs Unmatched
└── LP Positions
```

### C. Alerts & Notifications
```
Important Alerts:
├── Approaching Market Expiry
├── Unmatched Positions
├── Low Liquidity Warning
└── High Price Impact
```

## 5. Key User Considerations

### A. Market Selection
- Choose market based on desired expiry
- Check liquidity before entering
- Consider trading volumes

### B. Position Management
- Keep track of PT/YT pairs
- Plan ahead for maturity
- Monitor yield rates

### C. Liquidity Provision
- Check pool fees
- Monitor impermanent loss
- Plan exit before maturity

## 6. Technical Integration Points

### A. Contract Calls
```typescript
// Check market expiry
const expiry = await market.expiry()
const isMatured = expiry <= currentTimestamp

// Get user positions
const ptBalance = await market.balanceOf(user)
const ytBalance = await market.balanceOfYT(user)

// Check if can redeem
const canRedeem = isMatured && ptBalance.eq(ytBalance)
```

### B. Transaction Flow
```typescript
// Deposit
1. GNODE.approve(vault.address)
2. vault.deposit()
3. SY.approve(market.address)
4. market.mintPY()

// Trade
1. token.approve(router.address)
2. router.swap()

// Redeem at maturity
1. market.redeemPY()
2. SY.redeem()
```

### C. Error Handling
```typescript
// Common checks
- Market not expired
- Sufficient balances
- Matched PT/YT for redemption
- Price impact limits
```