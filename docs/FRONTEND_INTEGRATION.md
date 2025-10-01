# Frontend Integration Guide

## 1. Contract Interactions

### Market Data
```typescript
// Get market info
const marketData = {
    expiry: await market.expiry(),
    totalPT: await market.totalSupplyPT(),
    totalYT: await market.totalSupplyYT(),
    exchangeRate: await sy.exchangeRate()
};

// Check if market is mature
const isMatured = marketData.expiry <= Math.floor(Date.now() / 1000);
```

### Deposit Flow
```typescript
// 1. Approve GNODE for vault
await gnodeToken.approve(vault.address, amount);

// 2. Deposit GNODE to get SY
await vault.deposit(amount, receiver);

// 3. Approve SY for market
await sy.approve(market.address, amount);

// 4. Mint PT/YT
await market.mintPY(amount, receiver);
```

### Trading Operations
```typescript
// PT/GNODE Trading
await ptGnodePool.swapExactTokensForTokens(
    amountIn,
    minAmountOut,
    deadline
);

// YT/GNODE Trading
await ytGnodePool.swapExactTokensForTokens(
    amountIn,
    minAmountOut,
    deadline
);
```

### Redemption at Maturity
```typescript
// Check if can redeem
const ptBalance = await market.balanceOf(user);
const ytBalance = await market.balanceOfYT(user);
const canRedeem = isMatured && ptBalance.eq(ytBalance);

if (canRedeem) {
    // 1. Redeem PT/YT for SY
    await market.redeemPY(amount);
    
    // 2. Redeem SY for GNODE
    await sy.redeem(amount);
}
```

## 2. User Position Tracking

### Balance Checks
```typescript
const positions = {
    // Raw token balances
    gnode: await gnodeToken.balanceOf(user),
    sy: await sy.balanceOf(user),
    
    // Market positions
    pt: await market.balanceOf(user),
    yt: await market.balanceOfYT(user),
    
    // LP positions
    ptGnodeLp: await ptGnodePool.balanceOf(user),
    ytGnodeLp: await ytGnodePool.balanceOf(user)
};
```

### Market Status
```typescript
const marketStatus = {
    isActive: !isMatured,
    timeToExpiry: marketData.expiry - currentTime,
    canRedeem: isMatured && hasMatchedPositions
};
```

## 3. UI Components

### Market Selection
```typescript
function MarketSelector() {
    const markets = [
        {
            name: "June 2024",
            expiry: 1719792000,
            address: "0x..."
        },
        // ... other markets
    ];

    return markets.map(market => (
        <MarketCard
            name={market.name}
            timeLeft={market.expiry - currentTime}
            isMatured={market.expiry <= currentTime}
        />
    ));
}
```

### Position Display
```typescript
function PositionCard({ market, user }) {
    const [positions, setPositions] = useState({});
    
    useEffect(() => {
        const loadPositions = async () => {
            const pt = await market.balanceOf(user);
            const yt = await market.balanceOfYT(user);
            
            setPositions({
                matched: pt.min(yt),
                unmatchedPT: pt.sub(yt),
                unmatchedYT: yt.sub(pt)
            });
        };
        
        loadPositions();
    }, [market, user]);

    return (
        <Card>
            <MatchedPositions amount={positions.matched} />
            <UnmatchedPositions 
                pt={positions.unmatchedPT}
                yt={positions.unmatchedYT}
            />
        </Card>
    );
}
```

### Trading Interface
```typescript
function TradingInterface({ pool, tokenIn, tokenOut }) {
    const [amount, setAmount] = useState("0");
    const [minOut, setMinOut] = useState("0");
    
    const swap = async () => {
        // 1. Approve if needed
        const allowance = await tokenIn.allowance(
            user,
            pool.address
        );
        if (allowance.lt(amount)) {
            await tokenIn.approve(pool.address, MaxUint256);
        }
        
        // 2. Execute swap
        await pool.swap(
            amount,
            minOut,
            deadline
        );
    };

    return (
        <TradeForm
            amount={amount}
            setAmount={setAmount}
            minOut={minOut}
            onSwap={swap}
        />
    );
}
```

## 4. Error Handling

### Common Errors
```typescript
try {
    await contract.method();
} catch (error) {
    if (error.code === 4001) {
        showError("Transaction rejected by user");
    } else if (error.message.includes("slippage")) {
        showError("Price moved too much, try again");
    } else if (error.message.includes("matured")) {
        showError("Market has expired");
    }
}
```

### Transaction States
```typescript
const [txState, setTxState] = useState({
    status: "idle", // idle, pending, success, error
    hash: null,
    error: null
});

async function handleTransaction(promise) {
    setTxState({ status: "pending" });
    try {
        const tx = await promise;
        setTxState({
            status: "pending",
            hash: tx.hash
        });
        
        await tx.wait();
        setTxState({
            status: "success",
            hash: tx.hash
        });
    } catch (error) {
        setTxState({
            status: "error",
            error: error.message
        });
    }
}
```

## 5. Event Subscriptions

### Market Events
```typescript
useEffect(() => {
    // Listen for trades
    const onTrade = (trader, amountIn, amountOut) => {
        updatePrices();
        if (trader === userAddress) {
            updateUserPositions();
        }
    };
    
    market.on("Trade", onTrade);
    return () => market.off("Trade", onTrade);
}, [market, userAddress]);
```

### Position Updates
```typescript
useEffect(() => {
    // Update positions every block
    const updatePositions = async () => {
        const [pt, yt] = await Promise.all([
            market.balanceOf(user),
            market.balanceOfYT(user)
        ]);
        setPositions({ pt, yt });
    };
    
    provider.on("block", updatePositions);
    return () => provider.off("block", updatePositions);
}, [market, user]);
```