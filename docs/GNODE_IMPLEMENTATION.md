# GNODE Yield Token Implementation

## Architecture Overview

### 1. Contract Structure
```
GnodeERC4626Vault (Base Vault)
         ↑
PendleGnodeERC4626SY (SY Layer)
         ↑
MockPendleMarket (PT/YT Layer)
```

### 2. Key Components

#### a) Vault (GnodeERC4626Vault)
- Holds GNODE tokens
- Tracks maturity periods
- Handles revenue injection
- Calculates exchange rates
- Implements ERC4626 standard

#### b) SY Token (PendleGnodeERC4626SY)
- Wraps vault interactions
- Standardizes yield interface
- Handles deposits/withdrawals
- Tracks user balances

#### c) Market (MockPendleMarket)
- Creates PT/YT pairs
- Manages token separation
- Handles redemptions
- Tracks PT/YT balances

## Implementation Details

### 1. Maturity Tracking
```solidity
struct DepositInfo {
    uint256 amount;
    uint256 maturityTime;
}
mapping(address => DepositInfo[]) public userDeposits;
```

### 2. Revenue Injection
```solidity
function injectRevenue(uint256 amount) external onlyRole(REVENUE_MANAGER_ROLE) {
    totalUnderlyingGnode += amount;
    // Exchange rate increases automatically
}
```

### 3. Exchange Rate Calculation
```solidity
function exchangeRate() public view returns (uint256) {
    if (totalShares == 0) return 1e18;
    return (totalUnderlyingGnode * 1e18) / totalShares;
}
```

## Yield Mechanics

### 1. Revenue Sources
- External GNODE injection
- No internal yield generation
- Admin-controlled revenue addition

### 2. Yield Distribution
- All yield goes to YT holders
- PT holders get fixed redemption value
- Exchange rate reflects yield accrual

### 3. Maturity Rules
- 1-year lock on deposits (configurable)
- Early withdrawal not allowed
- PT/YT separation possible before maturity

## Testing Scenarios

### 1. Basic Flow Test
```typescript
// 08_test_pt_yt.ts
1. User deposits GNODE
2. Receives PT + YT
3. Can transfer separately
4. Revenue injection increases value
5. Redemption requires both tokens
```

### 2. Trading Economics Test
```typescript
// 09_test_pt_pricing.ts
1. Deposit and split tokens
2. Sell YT for premium
3. Hold PT for appreciation
4. Exit before maturity
```

## Security Considerations

### 1. Access Control
- REVENUE_MANAGER_ROLE for injection
- PAUSER_ROLE for emergencies
- UPGRADER_ROLE for upgrades
- EMERGENCY_ROLE for recovery

### 2. Validation Checks
- Maturity period enforcement
- Balance/allowance checks
- Reentrancy protection
- Exchange rate boundaries

### 3. Upgrade Safety
- UUPS proxy pattern
- State variable protection
- Initialization guards
- Role preservation

## Deployment Process

### 1. Contract Deployment
```typescript
1. Deploy Mock GNODE
2. Deploy Vault (upgradeable)
3. Deploy SY wrapper
4. Deploy Market Factory
5. Create Market
```

### 2. Configuration
```typescript
1. Set roles (REVENUE_MANAGER, etc.)
2. Configure maturity period
3. Set initial exchange rate
4. Approve necessary permissions
```

## Integration Points

### 1. External Interfaces
- ERC20 for tokens
- ERC4626 for vault
- Pendle SY standard
- Market factory integration

### 2. Dependencies
- OpenZeppelin contracts
- Pendle core libraries
- Hardhat environment
- Ethers.js utilities

## Limitations and Caveats

### 1. Technical Limitations
- Fixed maturity periods
- Manual revenue injection
- No automatic yield
- Discrete exchange rate updates

### 2. Economic Constraints
- PT price volatility
- YT premium risk
- Liquidity requirements
- Market making needs

### 3. Operational Considerations
- Admin key management
- Revenue timing
- Market monitoring
- Emergency procedures

## Future Improvements

### 1. Technical Enhancements
- Automatic yield distribution
- Variable maturity periods
- Better price discovery
- Enhanced market making

### 2. Economic Features
- Yield rate targeting
- Dynamic PT pricing
- Automated market making
- Liquidity incentives

### 3. Operational Tools
- Monitoring dashboard
- Revenue scheduling
- Market analytics
- Risk management
