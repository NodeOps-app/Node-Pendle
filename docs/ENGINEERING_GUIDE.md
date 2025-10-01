# Engineering Guide — NODE/gnode × Pendle Integration

Audience: protocol/dev engineers. This document explains the code structure, execution flows, invariants, and integration points to maintain/extend the system safely.

## 1) Canonical Terms
- Underlying: NODE (ERC-20, 18 decimals)
- Vault shares: gnode (ERC-20, non-rebasing, 18 decimals; EIP-2612 permit recommended)
- Vault: ERC-4626 with asset=NODE, shares=gnode
  - Exchange rate E(t) = totalAssets / totalSupply = NODE_per_gnode
- SY: Not-Redeemable-To-Asset wrapper over the Vault (accepts NODE/gnode in; redeems to gnode only)
- Queue/Lock: off-ramp contract that converts gnode → NODE with delays/caps

## 2) Code Layout (NodeOpsV2)
- `GnodeVault.sol` (ERC-4626)
  - Inherits: ERC4626Upgradeable, ERC20PermitUpgradeable, ReentrancyGuardUpgradeable, AccessControlUpgradeable, UUPSUpgradeable
  - Roles: `DEFAULT_ADMIN_ROLE`, `UPGRADER_ROLE`, `QUEUE_ROLE`
  - Events: `RevenueAdded(amount, totalAssetsAfter, exchangeRate)`
  - Key overrides:
    - `totalAssets()`: balanceOf(NODE, address(this))
    - `withdraw(...)` and `redeem(...)`: only `QUEUE_ROLE`, `nonReentrant`
  - Helpers:
    - `donateRevenue(amount)`: transferFrom(NODE) into vault; increases totalAssets; emits event

- `GnodeQueue.sol`
  - Inherits: Initializable, ReentrancyGuardUpgradeable, AccessControlUpgradeable, UUPSUpgradeable
  - Roles: `DEFAULT_ADMIN_ROLE`, `UPGRADER_ROLE`, `OPERATOR_ROLE`
  - State:
    - `vault` (ERC4626), `gnode` (IERC20 of vault’s share), `node` (IERC20 of vault asset)
    - epoch parameters: `minDelay`, `epochSize`, `epochOutflowLimit`, `epochStart`, `epochOutflowUsed`
    - requests: mapping `requestId => { shares, earliest, user, claimed }`
  - Events: `ParamsUpdated`, `Requested`, `Claimed`
  - Flow:
    - `requestRedeem(shares)`: records request; transfers `gnode` from user to queue
    - `claim(id, minAssetsOut)`: after `earliest` and within `epochOutflowLimit`:
      - approve `gnode` to vault; call `vault.redeem(shares, user, address(this))`
      - increment `epochOutflowUsed`; mark claimed; emit `Claimed`

- `PendleGnodeERC4626SY.sol`
  - Extends: `PendleERC4626NotRedeemableToAssetSY`
  - Behavior:
    - tokenIn: NODE or gnode; `_deposit` either deposits NODE into vault or passes through gnode 1:1
    - tokenOut (redeem): gnode only (never NODE)
    - `exchangeRate()` mirrors vault’s totalAssets/totalSupply

## 3) Execution Flows

### 3.1 Deposit NODE → SY → Vault
1. User calls `SY.deposit(receiver, NODE, amount, minSharesOut)`
2. SY transfers NODE in; deposits to vault (ERC4626) → mints gnode to SY
3. SY mints SY shares to receiver (SY shares represent wrapped gnode)

Notes:
- SY must not hold idle NODE. Any NODE received is deposited immediately.
- For gnode deposits, `_deposit` is a 1:1 pass-through.

### 3.2 Split to PT/YT (via Pendle Router)
- Router pulls SY from user and mints PT/YT per Pendle factory rules
- YT accrual = notional × ΔE where E is read from SY (mirrors vault E)

### 3.3 Redeem (user → SY → gnode)
- Pre-exp combine: Router combines PT+YT into SY, user redeems SY → gnode
- Post-exp PT exit: Router redeems PT to SY; user redeems SY → gnode
- To reach NODE: user submits `gnode` to `GnodeQueue` → later `claim()` returns NODE

### 3.4 Queue Off-ramp (gnode → NODE)
- `requestRedeem(shares)` stores request (timestamp+delay), transfers `gnode`
- `claim(id, minAssetsOut)` checks delay/caps, redeems from `GnodeVault` to user in NODE

## 4) Rounding & Decimals (must match tests)
- Decimals: NODE=18, gnode=18; SY mirrors gnode decimals
- Rounding:
  - previewDeposit / convertToShares: floor
  - previewMint    / convertToAssets: ceil
  - previewWithdraw/ convertToShares: ceil
  - previewRedeem  / convertToAssets: floor
- S=0 bootstrap: 1:1 initial rate; avoid dust that skews E(0)

## 5) Access Control & Upgradeability
- Vault (`GnodeVault`): UUPS; `UPGRADER_ROLE` required; `QUEUE_ROLE` required to withdraw/redeem
- Queue (`GnodeQueue`): UUPS; `OPERATOR_ROLE` can update delay/epochs/caps
- SY: typically non-upgradeable in listings (wrapper inherits a non-upgradeable SY flavor)
- Governance: provide multisig + timelock; documented notice windows

## 6) Security Model & Invariants
- SY never transfers NODE to end users; tokenOut is always gnode
- Any NODE received by SY is immediately deposited; SY should not idle NODE balances
- gnode is non-rebasing; yield accrues via E(t)=A/S
- Negative events: A(t) can drop → E(t) decreases; we do not clamp; YT accrual can be ≤ 0 in that window
- NonReentrancy on vault withdraw/redeem and queue claim paths
- Fee-on-transfer NODE: either forbid (recommended) or adjust accounting explicitly (not implemented by default)

## 7) Events & Observability
- Vault: `RevenueAdded` on donations
- Queue: `ParamsUpdated`, `Requested`, `Claimed`
- SY: emits SYBase `Deposit`/`Redeem` with tokenIn/tokenOut context

## 8) Failure Modes & Handling
- Queue cap reached: `claim` reverts with `cap`; user retries in next epoch
- Delay not elapsed: `claim` reverts with `delay`
- Slashing/penalty: E(t) drops; downstream UIs must communicate; YT claims reflect ΔE
- Insufficient allowance on NODE/gnode transfers: standard ERC20 failures

## 9) Integration Notes (Pendle)
- SY artifact: `PendleERC4626NotRedeemableToAssetSY` (wrapping Vault)
- `exchangeRate()` on SY must equal vault E(t)
- Router methods used in scripts:
  - `mintPyFromSy(receiver, YT, netSyIn, minPyOut)`
  - `redeemPyToSy(receiver, YT, netPtIn, netYtIn, minSyOut)` (pre-exp combine)
  - `exitPostExpToSy(receiver, market, netPtIn, ...)` (post-exp PT)
  - `redeemDueInterestAndRewards(user, [SY], [YT], [])`

## 10) Testing Checklist (must pass)
- Rounding: 1-wei edges for all 4 preview paths
- Bootstrap: S=0 then deposits across rising E(t)
- Deposit parity: deposit NODE vs deposit gnode yields consistent SY shares
- SY invariant: redeem never returns NODE; adversarial calls revert
- Negative event: drive A(t) down; verify ΔE ≤ 0 accrual
- Router flows: split/combine across intervals; PT exit post-exp; YT transfer mid-interval snapshotting
- Queue edges: delay/cap logic, epoch roll-over

## 11) Scripts (minev2)
- `01-deploy-stack.js`: deploy Vault, Queue, grant `QUEUE_ROLE`, deploy SY
- `02-bootstrap-and-mint.js`: fund NODE (mock), deposit NODE → SY
- `03-create-pt-yt-and-market.js`: factory create PT/YT and market
- `04-approve-and-mint-py.js`: mint PY from SY
- `05-queue-request-and-claim.js`: request and claim NODE via Queue
- `06-redeem-and-verify-post-exp.js`: post-exp PT → SY; then user redeems SY → gnode

## 12) Roadmap Hooks
- Add EIP-2612 `permit` to gnode (if shares are a standalone ERC20)
- Fee-on-transfer guardrails for NODE (explicitly forbid or account)
- Admin table fill-in (multisig, timelock, pause scopes) before external review

## 13) Queue Examples (for tests)

Example 1: Simple single-user exit
- Params: `minDelay=3600s`, `epochSize=86400s`, `epochOutflowLimit=10000 NODE`
- State: `epochOutflowUsed=0`, `E=1.20`
- Alice: `requestRedeem(1000 gnode)` at 09:00 → `earliest=10:00`; queue holds 1000 gnode
- 10:00 claim: `preview≈1200 NODE`; cap check `0+1200 ≤ 10000` OK; `redeem()` sends ~1200 NODE; `epochOutflowUsed=1200`

Example 2: Two users, cap hit mid-epoch
- Start of epoch: `epochOutflowUsed=9000`, `E=1.20`, `epochOutflowLimit=10000`
- Bob: `requestRedeem(1000)`; Carol: `requestRedeem(1500)` (both earliest next hour)
- At claim time: `preview_Bob≈1200`, `preview_Carol≈1800`
  - Bob’s cap check: `9000+1200=10200 > 10000` → revert; must wait next epoch (after rollover)
  - After rollover: `epochOutflowUsed=0`; Bob claims (consumes ~1200), Carol claims (consumes ~1800) if within limit

Example 3: Delay + slippage guard on negative event
- Params as Example 1; Alice `requestRedeem(5000)` with `minAssetsOut=5950`
- E drops from 1.20 → 1.18 before claim; `preview≈5900`
- Claim: cap OK; `assetsOut=5900 < 5950` → revert by minAssetsOut; Alice retries with lower min or later when E recovers
