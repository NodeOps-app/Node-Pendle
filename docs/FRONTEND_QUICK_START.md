## NodeOps V2 — Frontend Quick Start

This guide summarizes what your dApp needs to integrate the V2 stack (Vault/gnode, SY, Queue, and Pendle PT/YT) for deposits, yield, and off‑ramping.

### 1) Addresses and ENV
- Use your local `.env` (or runtime config) to provide:
  - `NODE` (or `NODE_TOKEN`): ERC‑20 underlying
  - `VAULT_ERC4626`: GnodeVault (UUPS proxy)
  - `SY_ADDRESS`: PendleGnodeERC4626SY
  - `GNODE_QUEUE`: GnodeQueue (UUPS proxy)
  - `PENDLE_ROUTER`, `PENDLE_YIELD_CONTRACT_FACTORY`, `PENDLE_MARKET_FACTORY`
  - (optional) `PT_ADDRESS`, `YT_ADDRESS`, `MARKET_ADDRESS`

Frontend should read these at startup and surface them in a settings panel.

### 2) What to show in UI
- Exchange rate E(t): read once per block/timer
  - `SY.exchangeRate()` (1e18; equals NODE_per_gnode from the vault)
  - Display as “1 gnode = E(t) NODE”
- Vault stats
  - `totalAssets()` and `totalSupply()` from `GnodeVault`
- Queue params and state
  - `minDelay()`, `epochSize()`, `epochOutflowLimit()`
  - `epochStart()`, `epochOutflowUsed()`
  - (For each user request): `requests(id)` → `{ shares, earliestClaimTime, user, claimed }`
- User balances
  - `NODE.balanceOf(user)`, `SY.balanceOf(user)`, `gnode.balanceOf(user)` (gnode is the vault address)
  - If PT/YT: `PT.balanceOf(user)`, `YT.balanceOf(user)`

### 3) Core user flows (with call sequences)

#### A) Deposit NODE (or gnode) → get SY
1) Approve the token you’re depositing to `SY_ADDRESS`.
2) Call `SY.deposit(user, tokenIn, amountIn, minSharesOut)`.
   - `tokenIn` is `NODE` or `gnode` (both supported). For `NODE`, SY internally deposits into the vault.
3) Update balances; show new `SY.balanceOf(user)`.

UX notes:
- Validate input > 0; show allowance prompt.
- For slippage/minOut: let user set a tolerance; default `minSharesOut=0` for dev.

#### B) Redeem SY → gnode (never NODE)
1) Choose amount of SY to redeem.
2) Call `SY.redeem(user, syAmount, VAULT_ERC4626, minSharesOut, false)`.
   - `tokenOut=VAULT_ERC4626` tells SY to return `gnode` (vault shares).
3) Update `gnode.balanceOf(user)`.

UX notes:
- Make it clear: SY never returns `NODE`. gnode is the only SY output.

#### C) Queue off‑ramp gnode → NODE (delayed, capped)
1) Approve `GNODE_QUEUE` to spend `gnode`.
2) Call `queue.requestRedeem(gnodeAmount)`.
   - Record returned `requestId`; track `requests(requestId)`.
3) UI countdown: `wait = max(0, earliestClaimTime - now)`.
4) After minDelay, call `queue.claim(requestId, minAssetsOut)`.

UX notes:
- Display current epoch progress and remaining outflow capacity:
  - `epochElapsed = now - epochStart`, `remaining = epochOutflowLimit - epochOutflowUsed`.
- If capacity is hit, guide users to wait until next epoch boundary: `(epochStart + epochSize)`.

#### D) Mint PY (PT+YT) from SY via Router
1) Ensure user holds SY; approve `PENDLE_ROUTER` for SY.
2) Call `router.mintPyFromSy(user, YT_ADDRESS, syAmountIn, minPyOut)`.
3) Update `PT.balanceOf(user)` and `YT.balanceOf(user)`.

UX notes:
- Show current E(t) and brief explanation: YT accrues yield from ΔE.

#### E) Claim YT yield
1) Call `router.redeemDueInterestAndRewards(user, [SY_ADDRESS], [YT_ADDRESS], [])`.
2) Output arrives in SY terms; user can redeem SY → gnode if desired.

#### F) Post‑expiry PT exit (optional)
1) Post‑T, use router’s post‑expiry exit for PT → SY.
2) Then `SY.redeem` to `gnode`; queue if user wants `NODE`.

### 4) Display math and rounding
- Exchange rate: `E = totalAssets / totalSupply` from the vault (mirrored by SY).
- YT accrual: `due ≈ ΔE × notional` since user’s last snapshot.
- ERC‑4626 rounding (preview vs actual):
  - deposit/convertToShares: floor
  - mint/convertToAssets: ceil
  - withdraw/convertToShares: ceil
  - redeem/convertToAssets: floor

UX tips:
- Show estimates and actuals separately when confirming.
- For 18‑decimals, format with 4–6 decimals in UI; show full precision on hover.

### 5) Error handling & edge cases
- ENS lookups: always pass checksum 0x addresses; avoid ENS on non‑ENS chains.
- Missing allowances: prompt approval and retry.
- Queue claim too early: surface `earliestClaimTime` clearly.
- Epoch cap exceeded: show remaining capacity and the next epoch timestamp.
- Fee‑on‑transfer tokens: not supported; `NODE` should be fee‑free.

### 6) Frontend state model (suggested)
- Global:
  - `addresses`: from env/config
  - `network`: chainId, rpc status
  - `rate`: `exchangeRate` + lastUpdated
  - `queue`: `minDelay`, `epochSize`, `epochOutflowLimit`, `epochStart`, `epochOutflowUsed`
- Per‑user:
  - balances: `NODE`, `SY`, `gnode`, `PT`, `YT`
  - `queueRequests`: list of `{id, shares, earliestClaimTime, claimed}`

### 7) Components checklist
- Header/network selector; addresses panel
- Balances and approvals
- Deposit (NODE/gnode → SY)
- Redeem (SY → gnode)
- Queue request/claim (gnode → NODE)
- PT/YT: mint PY; (optional) redeem/claim views
- Yield claim (YT): call router claim; show ΔE since last claim
- Rate & stats: E(t), vault totals, queue capacity/countdown

### 8) Minimal ABI fragments (ethers.js)
- SY: `exchangeRate()`, `balanceOf(address)`, `deposit(address,address,uint256,uint256)`, `redeem(address,uint256,address,uint256,bool)`
- Vault: `totalAssets()`, `totalSupply()`, `convertToAssets(uint256)`, `convertToShares(uint256)`, `balanceOf(address)`
- Queue: `minDelay()`, `epochSize()`, `epochOutflowLimit()`, `epochStart()`, `epochOutflowUsed()`, `requests(uint256)`, `requestRedeem(uint256)`, `claim(uint256,uint256)`
- Router: `mintPyFromSy(address,address,uint256,uint256)`, `redeemDueInterestAndRewards(address,address[],address[],address[])`

### 9) Dev tips
- Always test on a local fork first; ensure `.env` addresses match deployed contracts.
- If a user has SY but the queue script fails, remember: redeem SY → gnode first, then queue.
- If your shell exports `NODE` path, prefer `NODE_TOKEN` in env to avoid collisions.


