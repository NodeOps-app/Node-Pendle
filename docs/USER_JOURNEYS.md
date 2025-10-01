# User Journeys - GNODE Yield Markets

## Understanding Market Structure

### Available Markets (Example)
```
Current Quarter Markets:
├── June 2024 Market (expires June 30, 2024)
├── September 2024 Market (expires Sept 30, 2024)
└── December 2024 Market (expires Dec 31, 2024)

Each market has:
├── PT/GNODE trading pool
├── YT/GNODE trading pool
└── PT/YT trading pool
```

## Common User Scenarios

### 1. "I want to lock GNODE for a fixed return"
```
User Goal: Lock 1000 GNODE for 6 months with guaranteed return
Steps:
1. Choose September 2024 market (closest to 6-month target)
2. Deposit 1000 GNODE → Get 1000 SY
3. Convert 1000 SY → Get 1000 PT + 1000 YT
4. Sell 1000 YT for GNODE (immediate yield monetization)
5. Hold PT until maturity
6. At maturity: Redeem PT for original 1000 GNODE

Result:
- Locked: 1000 GNODE (as PT)
- Immediate return: ~50 GNODE (from YT sale)
- Total return: Fixed 5% over 6 months
```

### 2. "I want to earn higher yield and don't mind price risk"
```
User Goal: Maximize yield on 1000 GNODE
Steps:
1. Choose December 2024 market (longest duration)
2. Deposit 1000 GNODE → Get 1000 SY
3. Convert 1000 SY → Get 1000 PT + 1000 YT
4. Sell 1000 PT at 0.95 GNODE each → Get 950 GNODE
5. Repeat steps 1-3 with 950 GNODE
6. Keep repeating (yield farming)

Result:
- Exposure to yield from multiple YTs
- Higher risk (PT price exposure)
- Potential for higher returns
```

### 3. "I want to provide liquidity and earn fees"
```
User Goal: Earn trading fees with 2000 GNODE
Options:
A. PT/GNODE Pool
   1. Split 2000 GNODE:
      - 1000 GNODE direct
      - 1000 GNODE → Convert to PT
   2. Add both to PT/GNODE pool
   3. Earn fees from PT/GNODE trades

B. YT/GNODE Pool
   1. Split 2000 GNODE:
      - 1000 GNODE direct
      - 1000 GNODE → Convert to YT
   2. Add both to YT/GNODE pool
   3. Earn fees from YT/GNODE trades
```

### 4. "I want to exit before maturity"
```
User Goal: Exit position early from June 2024 market
Options:
A. Have both PT + YT:
   1. Sell both separately:
      - PT → GNODE (PT/GNODE pool)
      - YT → GNODE (YT/GNODE pool)
   OR
   2. Recombine PT+YT → SY → GNODE

B. Have only PT:
   1. Sell PT → GNODE (PT/GNODE pool)
   OR
   2. Buy matching YT, then redeem

C. Have only YT:
   1. Sell YT → GNODE (YT/GNODE pool)
   OR
   2. Buy matching PT, then redeem
```

### 5. "I want to arbitrage between markets"
```
User Goal: Profit from price differences
Strategies:
A. Cross-Market PT Arbitrage
   1. Buy PT from June market at 0.95
   2. Sell PT in September market at 0.97
   3. Profit from price difference

B. YT Yield Arbitrage
   1. Buy YT from June market (shorter term)
   2. Sell YT in December market (longer term)
   3. Profit from yield difference
```

## Market Transitions

### When Markets Mature
```
Example: June 2024 Market Matures
1. June market stops trading
2. New March 2025 market opens
3. Users with June positions:
   A. Matched PT+YT → Redeem for GNODE
   B. Unmatched PT → Buy YT to redeem
   C. Unmatched YT → Buy PT to redeem
```

### Planning Ahead
```
Best Practices:
1. Match PT+YT before maturity (better prices)
2. Plan exits around market openings/closings
3. Consider rolling positions to newer markets
4. Watch for new market opportunities
```

## Key User Considerations

### 1. Choosing the Right Market
```
Factors to Consider:
├── Time until maturity matches your goal
├── Market liquidity (newer markets may have less)
├── Current PT/YT prices
└── Trading volume/activity
```

### 2. Risk Management
```
Key Risks:
├── PT price volatility
├── YT yield changes
├── Liquidity risk
└── Maturity matching risk
```

### 3. Cost Efficiency
```
Transaction Costs:
├── Initial deposit (GNODE → SY)
├── Converting (SY → PT/YT)
├── Trading fees
└── Redemption costs
```

## Common Mistakes to Avoid

1. **Wrong Market Selection**
   - Entering market with too short/long maturity
   - Not checking liquidity first

2. **Poor Position Management**
   - Forgetting to match PT/YT before maturity
   - Not monitoring yield rates

3. **Liquidity Issues**
   - Adding liquidity to low-volume pools
   - Trading large amounts in illiquid markets

4. **Maturity Handling**
   - Waiting until maturity to match positions
   - Missing redemption windows

## Best Practices

1. **Market Entry**
   ```
   ✓ Choose market based on investment timeframe
   ✓ Check liquidity and trading volume
   ✓ Compare rates across markets
   ✓ Start with simple strategies
   ```

2. **Position Management**
   ```
   ✓ Keep PT+YT matched if planning to hold
   ✓ Monitor yield rates for opportunities
   ✓ Plan exits before maturity
   ✓ Diversify across markets if needed
   ```

3. **Liquidity Provision**
   ```
   ✓ Provide liquidity to active pools
   ✓ Monitor impermanent loss
   ✓ Remove liquidity before maturity
   ✓ Reinvest fees for compound returns
   ```