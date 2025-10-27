## Frontend Integration: PT/YT Trading, YT Claiming, Deposits, Liquidity, Queue

This checklist enumerates all on-chain functions your frontend will call for the V2 (NODE/gnode) + Pendle flow. Use it to wire actions and approvals. All addresses come from your runtime config: `SY_ADDRESS`, `VAULT_ERC4626`, `GNODE_QUEUE`, `PENDLE_ROUTER`, `PT_ADDRESS`, `YT_ADDRESS`, `MARKET_ADDRESS`, `NODE` (or `NODE_TOKEN`).

### 0) Read model (poll on interval or block)
- Rates/metrics
  - `SY.exchangeRate() -> uint256` (E(t)=NODE_per_gnode)
  - `Vault.totalAssets()`, `Vault.totalSupply()`
- Balances
  - `ERC20.balanceOf(user)` for `NODE`, `SY`, `gnode` (vault address), `PT`, `YT`, and LP (`Market.balanceOf(user)`)
- Allowances (before actions)
  - `ERC20.allowance(user, spender)` (spender = `SY_ADDRESS`, `PENDLE_ROUTER`, `GNODE_QUEUE`)
- Queue params
  - `Queue.minDelay()`, `epochSize()`, `epochOutflowLimit()`, `epochStart()`, `epochOutflowUsed()`
  - Requests: `Queue.requests(id)` → `{ shares, earliestClaimTime, user, claimed }`
- Market/expiry (optional)
  - PT expiry from the yield factory/PT; AMM reserves via RouterStatic/SDK for richer pool stats

### 1) Approvals (common)
- `ERC20.approve(spender, amount)`
  - To deposit NODE: approve `NODE -> SY_ADDRESS`
  - To deposit gnode: approve `gnode -> SY_ADDRESS`
  - To mint PY: approve `SY -> PENDLE_ROUTER`
  - To add liquidity: approve `PT -> PENDLE_ROUTER` and `SY -> PENDLE_ROUTER`
  - To queue off-ramp: approve `gnode -> GNODE_QUEUE`
  - To donate (ops only): approve `NODE -> VAULT_ERC4626`

### 2) Deposits and redemptions (SY wrapper)
- Deposit NODE or gnode → get SY
  - `SY.deposit(receiver, tokenIn, amountIn, minSharesOut)`
    - `tokenIn` = `NODE` or `gnode`
- Redeem SY → gnode (never NODE)
  - `SY.redeem(receiver, syAmount, tokenOut=VAULT_ERC4626, minSharesOut, false)`

Notes
- SY immediately vaults NODE and holds gnode internally; `exchangeRate()` reflects vault E(t).
- SY never returns `NODE`; use the queue to off-ramp gnode → NODE.

### 3) Mint PT+YT (PY) from SY (Router)
- `Router.mintPyFromSy(receiver, YT_ADDRESS, netSyIn, minPyOut)`
  - Requires SY allowance to Router.
  - Mints PT and YT to `receiver`.

### 4) Claim YT yield (Router)
- `Router.redeemDueInterestAndRewards(user, [SY_ADDRESS], [YT_ADDRESS], [])`
  - Pays out in SY terms (redeem to gnode if desired).
  - Snapshot advances after claim.

### 5) Combine PT+YT back to SY (pre-exp) / PT post-exp exit (Router)
- Pre-exp combine (example signature; use your SDK/helper for exact call):
  - `Router.redeemPyToSy(receiver, YT_ADDRESS, netPtIn, netYtIn, minSyOut)`
- Post-exp PT exit to SY (example):
  - `Router.exitPostExpToSy(receiver, MARKET_ADDRESS, netPtIn, ...)`
- Then: `SY.redeem(receiver, syAmount, VAULT_ERC4626, minSharesOut, false)` → gnode

Tip
- Prefer using the Pendle SDK/RouterStatic for quoting and exact params for combine/exit.

### 6) Liquidity: add/remove (PT/SY Market)
- Dual-sided add
  - `Router.addLiquidityDualSyAndPt(receiver, MARKET_ADDRESS, netSyIn, netPtIn, minLpOut)`
  - Needs approvals: `SY -> Router`, `PT -> Router`
- Remove liquidity
  - `Router.removeLiquidity(receiver, MARKET_ADDRESS, lpIn, minPtOut, minSyOut)` (or variant)
  - Approve LP to Router if required (Market is ERC20)

Optional
- Single-sided methods vary by router version; if unsupported, stick to dual-sided.

### 7) Queue off-ramp: gnode → NODE (delayed & capped)
- Request
  - `Queue.requestRedeem(gnodeAmount)` → `requestId`
- Claim (after `earliestClaimTime` and under epoch cap)
  - `Queue.claim(requestId, minAssetsOut)`

UI hints
- Show countdown to `earliestClaimTime`, remaining epoch capacity `epochOutflowLimit - epochOutflowUsed`, and next epoch time `epochStart + epochSize`.

### 8) Yield injection (ops/test only)
- Donate NODE into the vault (increases E(t), benefits YT)
  - Approve: `NODE -> VAULT_ERC4626`
  - `Vault.donateRevenue(amount)`

### 9) Minimal ABIs (ethers.js)
- ERC20: `balanceOf`, `allowance`, `approve`
- SY: `exchangeRate`, `balanceOf`, `deposit(address,address,uint256,uint256)`, `redeem(address,uint256,address,uint256,bool)`
- Vault: `totalAssets`, `totalSupply`, (ops) `donateRevenue(uint256)`
- Queue: `minDelay`, `epochSize`, `epochOutflowLimit`, `epochStart`, `epochOutflowUsed`, `requests(uint256)`, `requestRedeem(uint256)`, `claim(uint256,uint256)`
- Router (subset used):
  - `mintPyFromSy(address,address,uint256,uint256)`
  - `redeemDueInterestAndRewards(address,address[],address[],address[])`
  - `addLiquidityDualSyAndPt(address,address,uint256,uint256,uint256)`
  - (optional) combine/exit post-exp: prefer SDK helpers for exact signatures

### 10) Frontend UX checklist
- Inline approvals before actions; show exact spender & amount.
- Always show E(t) and explain gnode is non-rebasing; SY never outputs NODE.
- For trades/combine, use SDK quotes to show minOut/slippage.
- For queue, surface delay and caps to avoid failed claims.


