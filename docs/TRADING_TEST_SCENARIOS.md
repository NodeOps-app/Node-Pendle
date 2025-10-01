# GNODE Trading Test Scenarios

[Previous content until Important Considerations remains the same...]

## Important Considerations

### Matured PT in Liquidity Pools

When PTs reach maturity, several important mechanics come into play:

1. **Redemption Mechanics**:
   - IMPORTANT: Both PT and YT are required for redemption at any time
   - At maturity, having only PT or only YT doesn't allow direct redemption
   - This means PTs in the pool can't be directly redeemed for GNODE without matching YTs

2. **Post-Maturity Trading**:
   - PTs in the pool remain tradeable
   - Their value should theoretically approach the redemption value (when paired with YT)
   - However, their standalone value might differ due to:
     - Difficulty in finding matching YTs
     - Cost of acquiring YTs from other holders
     - Time value of money

3. **LP Considerations**:
   - LPs providing PT liquidity post-maturity take on specific risks:
     - Harder to find YTs for redemption
     - Potential price divergence from theoretical value
     - Reduced trading volume as most holders redeem
   - They might want to remove liquidity before maturity to:
     - Ensure they have matching PT/YT pairs
     - Avoid post-maturity liquidity risks
     - Participate in direct redemption

4. **Market Dynamics**:
   - Post-maturity PT price might trade at a discount to redemption value
   - This discount represents the cost/difficulty of finding matching YTs
   - Market makers might create specialized pools for matching mature PT/YT pairs

### Pool Liquidity Source Analysis

[Rest of the content remains the same...]