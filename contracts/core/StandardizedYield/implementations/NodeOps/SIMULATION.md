# Gnode Yield Token - Complete E2E Simulation

This document simulates various scenarios and user interactions with the Gnode yield system.

## Scenario 1: Multiple Users with Different Entry Points

```javascript
// Initial Setup
Time: Jan 1, 2024
Revenue Rate: 2% monthly (example)

// User A: Early Adopter
Time: Jan 1, 2024
Action: Deposits 100 GNODE
- Receives: 100 SY tokens
- Maturity: Jan 1, 2025 (365 days)
- Initial Exchange Rate: 1.0

// User B: Month Later
Time: Feb 1, 2024
- System has accumulated 2 GNODE revenue
- Total GNODE in vault: 102
- Total SY supply: 100
- New Exchange Rate: 1.02

Action: Deposits 100 GNODE
- Receives: 98.039 SY tokens (100/1.02)
- Maturity: Feb 1, 2025
- Their SY tokens worth: 100 GNODE

Current State:
- Total GNODE: 202
- Total SY: 198.039
- Exchange Rate: 1.02
```

## Scenario 2: Revenue Distribution Over Time

```javascript
// Monthly Revenue Injection
Jan: +2 GNODE
Feb: +2 GNODE
Mar: +2 GNODE

// After 3 months (March 1)
User A (100 SY tokens):
- Initial: 100 GNODE
- Now worth: 106 GNODE
- Can claim: 6 GNODE yield
- Principal still locked

User B (98.039 SY tokens):
- Initial: 100 GNODE
- Now worth: 104 GNODE
- Can claim: 4 GNODE yield
- Principal still locked

Exchange Rate: 1.06
```

## Scenario 3: PT/YT Creation and Trading

```javascript
// User A creates PT/YT (March 1)
Initial:
- Has 100 SY tokens
- Worth: 106 GNODE (with yield)

Action: Creates PT/YT position
Receives:
- 100 PT tokens (represents locked principal)
- 100 YT tokens (represents yield rights)

// Trading Scenarios
1. Selling YT:
- Buyer expects ~8% remaining yield (2% * 4 months)
- Can price YT based on expected yield
- Original holder keeps PT (principal claim)

2. Selling PT:
- Worth less than face value (time value discount)
- Price increases as maturity approaches
- Example: PT might trade at 0.95 GNODE in March
          and 0.98 GNODE in November

3. Market Making:
- AMM pools for PT/GNODE
- AMM pools for YT/GNODE
- Price curves reflect time value and yield expectations
```

## Scenario 4: Different Maturity Windows

```javascript
// Three users deposit same amount, different times

User A: Jan 1, 2024
- Deposit: 100 GNODE
- Maturity: Jan 1, 2025
- SY received: 100

User B: Apr 1, 2024
- Deposit: 100 GNODE
- Maturity: Apr 1, 2025
- Exchange Rate: 1.06
- SY received: ~94.34

User C: Jul 1, 2024
- Deposit: 100 GNODE
- Maturity: Jul 1, 2025
- Exchange Rate: 1.12
- SY received: ~89.29

// Maturity Timeline
Jan 1, 2025:
- User A can redeem principal
- B and C still locked
- All can claim yield

Apr 1, 2025:
- User B can redeem principal
- C still locked
- All can claim yield

Jul 1, 2025:
- All users can redeem principal
```

## Scenario 5: Yield Calculation Examples

```javascript
// Example with different deposit sizes

Initial State:
Total GNODE in vault: 1000
Monthly Revenue: 20 GNODE

User A: 500 SY (50% of pool)
User B: 300 SY (30% of pool)
User C: 200 SY (20% of pool)

When 20 GNODE revenue is added:
User A yield: 10 GNODE (50% of 20)
User B yield: 6 GNODE (30% of 20)
User C yield: 4 GNODE (20% of 20)

// Compound Effect
If users don't claim yield:
- Exchange rate increases
- Next revenue distribution based on same proportions
- Unclaimed yield automatically compounds
```

## Scenario 6: Market Dynamics

```javascript
// PT Market Price Factors
1. Time to Maturity:
- Longer time = Bigger discount
- Price approaches 1:1 near maturity

2. Interest Rates:
- Higher rates = Bigger PT discount
- Lower rates = Smaller PT discount

// YT Market Price Factors
1. Expected Future Yield:
- Higher expected revenue = Higher YT price
- Lower expected revenue = Lower YT price

2. Time Remaining:
- More time = More potential yield = Higher price
- Less time = Less potential yield = Lower price

// Example PT Price Curve
12 months to maturity: 0.92 GNODE
6 months to maturity: 0.96 GNODE
1 month to maturity: 0.99 GNODE
At maturity: 1.00 GNODE
```

## Scenario 7: Emergency and Edge Cases

```javascript
// Scenario: Large Revenue Injection
Initial:
- 1000 GNODE in vault
- 1000 SY tokens
- Rate: 1.0

Sudden large revenue: +500 GNODE
New state:
- 1500 GNODE in vault
- Still 1000 SY tokens
- New rate: 1.5
- All positions instantly worth 50% more

// Scenario: Zero Revenue Period
- PT price might decrease
- YT price would drop
- No impact on principal safety

// Scenario: Emergency Pause
- Deposits suspended
- Revenue injection continues
- Existing positions keep earning
- PT/YT trading continues
```

## Key Observations

1. **Yield Distribution**:
   - Proportional to SY token holdings
   - Automatic through exchange rate
   - Claimable anytime through YT

2. **Maturity Windows**:
   - Individual per deposit
   - Independent of yield claims
   - Affects principal only

3. **Market Mechanics**:
   - PT price reflects time value
   - YT price reflects yield expectations
   - Both tradeable independently

4. **Risk Considerations**:
   - Principal protected (time-locked)
   - Yield variable but proportional
   - Market prices reflect risk/reward
