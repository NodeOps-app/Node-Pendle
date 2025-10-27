## Adding Liquidity on Pendle (PT/SY) — NodeOps V2

This guide explains how to add/remove liquidity to a Pendle PT/SY market for your `gnode` integration, how to size inputs, and which approvals/calls your app should make. It covers both CLI/scripts (for testing) and frontend wiring concepts.

### What pool you LP into
- Liquidity is added to a PT/SY Market for a specific expiry (one market per expiry).
- Assets in the pool are exactly that market’s `PT` and `SY` (no separate YT pool).
- In your V2 design:
  - SY wraps the vault (asset=NODE, shares=gnode) and never outputs NODE; redemptions return `gnode` only.
  - PT/YT are minted against this SY and reference the same expiry.

### Prerequisites (addresses & env)
Have these configured (in `.env` or runtime config):
- `SY_ADDRESS`, `VAULT_ERC4626`, `GNODE_QUEUE`, `PENDLE_ROUTER`
- `PT_ADDRESS`, `YT_ADDRESS`, `MARKET_ADDRESS` (created for your chosen expiry)
- Optional input sizing: `PT_IN`, `SY_IN`, `MIN_LP_OUT`

### Approvals (typical)
- Dual-sided add: approve `PT -> PENDLE_ROUTER` and `SY -> PENDLE_ROUTER`.
- If minting PT from SY (PY mint) before adding: approve `SY -> PENDLE_ROUTER`.

### Sizing inputs (ratio & balancing)
- There’s no fixed 50/50 ratio. The optimal PT:SY depends on the pool state and PT price (discount vs SY).
- Practical rule:
  - If PT is near par and `E(t)≈1`, use the same notional (e.g., `PT_IN ≈ SY_IN`).
  - Otherwise, fetch quotes (SDK/RouterStatic) to size PT and SY for best utilization.
- If your ratio is off, the router will only use the amounts it needs; remaining tokens stay with the user.

### User asset production paths
- If the user only has NODE or gnode:
  1) Deposit to SY (NODE or gnode → SY).
  2) Mint PY (PT+YT) from a portion of SY to obtain PT.
  3) Add dual-sided liquidity with the resulting PT + remaining SY.
- If the user already holds SY and needs PT:
  - Mint PY (PT+YT) from SY to produce PT; then add dual-sided.

### Scripts (local testing)
- Create PT/YT + Market: `npx hardhat run scripts/minev2/03-create-pt-yt-and-market.js --network localhost`
- Mint PY from SY: `npx hardhat run scripts/minev2/04-approve-and-mint-py.js --network localhost`
- Add dual-sided liquidity (auto pick signer, mint PT if needed):
  - Set `PT_IN`, `SY_IN`, `MIN_LP_OUT` in `.env`
  - `npx hardhat run scripts/minev2/09-add-liquidity-dual-auto.js --network localhost`
- Remove liquidity (use your router remove flow or SDK helper; add a script similarly to dual add):
  - Approve LP (Market token) to Router; call `removeLiquidity(market, lpIn, minPtOut, minSyOut)`.

### Frontend wiring (dual-sided)
1) Load pool & user state
   - `SY.exchangeRate()` (display as “1 gnode = E(t) NODE”).
   - `Market.balanceOf(user)`, `Market.totalSupply()` (LP position & share).
   - User balances: `PT`, `SY`; allowances to `PENDLE_ROUTER`.
2) Size inputs
   - Either: ask the user for `PT_IN` and `SY_IN` (show hints to match pool ratio), or
   - Use SDK/RouterStatic to suggest a split (quote `netSyUsed`, `netPtUsed`, `expectedLpOut`).
3) Ensure approvals
   - If `PT.allowance < PT_IN` → approve.
   - If `SY.allowance < SY_IN` → approve.
4) Add liquidity
   - Call `Router.addLiquidityDualSyAndPt(receiver, MARKET_ADDRESS, SY_IN, PT_IN, minLpOut)`.
   - Refresh LP balance and share.
5) Remove liquidity
   - Approve LP to Router if required, then call remove; show recovered `PT` and `SY`.

### Single‑sided adds (note)
- Function names and availability vary by router version; if unsupported, prefer dual-sided with a pre‑mint of the missing side (PY mint from SY).

### Yields, APR & incentives (optional)
- Pool rewards: fee APRs and PENDLE incentives depend on listing. Use Pendle SDK/subgraph to show APRs and accumulated rewards.
- YT yield:
  - Claim via `Router.redeemDueInterestAndRewards(user, [SY],[YT],[])` (pays in SY).
  - If desired, redeem SY → gnode; to get NODE, queue gnode → NODE (delay/outflow caps).

### Post‑maturity flows
- PT post‑expiry exit: Router’s post‑exp call → returns SY. Then `SY.redeem → gnode`. Queue if user wants NODE.
- YT at expiry: value trends to 0 as yield window ends.

### Solvency & safety (V2 specifics)
- ERC‑4626 vault has `asset=NODE`, `shares=gnode`, `E(t)=totalAssets/totalSupply`.
- Deposits/withdraws/queue redeems change assets & shares proportionally → E constant (up to rounding).
- Donations increase assets only → E↑ (YT accrues). Slashing (if any) decreases assets only → E↓.
- SY never outputs NODE. NODE exits are gated by `GnodeQueue` (minDelay, epoch caps) to prevent instant dumps.

### Common errors & fixes
- “Not enough SY/PT”: mint PY from SY (for PT) or deposit more to SY.
- “Invalid selector” on single‑sided methods: your router may not support that function; use dual-sided.
- “Missing/invalid address”: ensure 0x addresses and correct expiry-specific `PT/YT/MARKET`.
- Shell `NODE` collision: prefer `NODE_TOKEN` env key over `NODE`.

### Minimal ABI references (ethers)
- Router: `mintPyFromSy(address,address,uint256,uint256)`, `addLiquidityDualSyAndPt(address,address,uint256,uint256,uint256)`, `redeemDueInterestAndRewards(address,address[],address[],address[])`.
- ERC20: `balanceOf`, `allowance`, `approve`.
- SY: `exchangeRate`, `deposit`, `redeem`.
- Market (LP): `balanceOf`, `totalSupply`.

### TL;DR Steps (dual‑sided)
1) Get `SY` (deposit NODE/gnode)
2) Mint `PT+YT` from a portion of `SY` (to get PT)
3) Approve `PT` and `SY` to Router
4) Call `addLiquidityDualSyAndPt` with sized `PT_IN`/`SY_IN`
5) Track LP position; remove later to retrieve `PT`+`SY`


