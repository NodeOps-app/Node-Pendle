# NodeOps V2: gnode (Liquid Staking) Integration with Pendle

## TL;DR
- We introduce `gnode`, a non-rebasing ERC20 share token (like wstETH) representing locked `NODE` in an external ERC4626 vault.
- Pendle integrates with the external ERC4626 (asset=NODE, shares=gnode) via an SY that never returns NODE (Not-Redeemable-To-Asset).
- SY exits always return `gnode`; converting `gnode` → NODE goes through our external queue/lock (no instant NODE dumps).
- Yield accrues as `NODE_per_gnode` increases inside the external vault; SY exchange rate E(t)=NODE_per_gnode, so YT captures yield over time.

## Components
- External ERC4626 Vault + Lock/Queue (yours):
  - Accepts NODE deposits, mints `gnode` based on a conversion rate.
  - Receives revenue injections in NODE and accrues value (increasing NODE per gnode).
  - Burns `gnode` to release NODE subject to your queue/lock/fees.
  - Non-rebasing: `gnode` balances remain constant; value accrues via the conversion rate.

- Pendle SY over external ERC4626 (Not-Redeemable-To-Asset flavor):
  - Yield token = external ERC4626 (asset=NODE, shares=gnode)
  - Deposit: NODE or gnode in; SY mints against the ERC4626.
  - Redeem: only vault shares/gnode out (never NODE out of SY).
  - E(t)=totalAssets/totalSupply of the external ERC4626 = NODE_per_gnode.

- Pendle SY wrapper (ERC4626 flavor):
  - Wraps the ERC4626 vault.
  - Tokens in/out: accepts NODE or gnode in; redeem returns gnode only (never NODE).
  - PT/YT minting and market creation proceed normally; YT prices reflect yield via SY exchange rate.

## Selected SY Flavor (resolved)
We will use the ERC4626 (asset=NODE, shares=gnode) + Not-Redeemable-To-Asset SY pattern. This yields the cleanest E(t)=NODE_per_gnode without needing donations to move E(t), and it matches common LSD integrations.

## User Flows
1) Deposit and SY mint
   - User acquires `gnode` (from your on-ramp or by depositing NODE into your external contract).
   - User deposits `gnode` into SY → receives SY shares.

2) Create PT/YT and trade
   - Using Pendle factories, create PT/YT over the SY token and a market.
   - Users can mint PT+YT from SY, trade PT/YT, provide liquidity, etc.

3) Revenue Accrual
   - You route NODE revenue into the external lock/queue, increasing `NODE_per_gnode`.
   - As `gnode` appreciates, the SY exchange rate (derived from ERC4626 totalAssets/totalSupply) increases.
   - YT captures this appreciation; PT approaches par at expiry.

4) Exits
   - SY → `gnode` instantly (standard redeem).
   - To reach NODE, holder uses your external contract’s queue/lock to unwrap `gnode` → NODE.
   - PT/YT exits:
     - Pre-exp: combine PT+YT via router to get SY, then SY → `gnode`.
     - Post-exp: PT → SY via router post-exp path, then SY → `gnode`.

## Tokens In/Out (SY)
- In (explicit):
  - NODE: forwarded by SY into the external ERC4626 via `deposit(NODE)`, minting `gnode` internally.
  - gnode (vault shares): accepted 1:1 into SY.
- Out (explicit):
  - gnode only (vault shares). SY never returns NODE on redeem.

## Why This Prevents NODE Dumps
- Pendle SY redemptions never return NODE. They return `gnode`.
- `gnode` → NODE must go through your external contract, which can impose queues/locks/fees/rate limits.
- This mirrors established LSD integrations (e.g., wstETH) where SY never exposes the raw underlying.

## Scripts/ENV Notes
- When using this SY flavor, `UNDERLYING` (tokenIn) can be NODE or gnode depending on deposit route; final tokenOut from SY is always gnode.
- PT/YT creation and market flows remain unchanged; only addresses change.
- Post-exp redemption in scripts should expect `gnode` as the end token, not NODE.

## Roles & Safety (Vault)
- External ERC4626:
  - Non-rebasing `gnode` (18 decimals). Monotonic accrual: NODE_per_gnode should never decrease under normal operations. Define behavior on negative events (slashing) and communicate clearly.
  - Decimals/rounding: 18 decimals; preview functions round down for mint/redeem to avoid over-crediting; document rounding behavior.
  - Upgradability: document admin(s), upgrade delay/notice, and emergency pause scope (if any). Pendle reviewers expect strict controls.
- SY (Not-Redeemable-To-Asset):
  - Never returns NODE; tokensOut limited to vault shares/gnode.
  - Decimals mirror the ERC4626 shares (18). Preview functions follow ERC4626 rounding norms.

## Rounding Rules (ERC4626 / SY expectations)
- previewDeposit / convertToShares: floor (round down)
- previewMint    / convertToAssets: ceil  (round up)
- previewWithdraw/ convertToShares: ceil  (round up)
- previewRedeem  / convertToAssets: floor (round down)
These are the common expectations integrators assume to avoid dust disputes.

## Open Decisions
- On-ramp UX: allow NODE deposits at SY (Not-Redeemable-To-Asset) or require users to first get `gnode`.
- Keep or remove the vault donate function (rename to `donate()` if kept).
- Naming: `gnode` token symbol, SY symbol, and vault naming for clarity across frontend.

## Summary
- Use Pendle over `gnode` to capture yield without exposing instant NODE exits.
- SY integrates like other LSDs: exchange rate reflects underlying accrual, YT monetizes yield, PT settles at maturity.
- Users always exit SY to `gnode`; NODE requires the external queue/lock, aligning with your lockup design.

## Mathematical Walkthrough

Notation:
- A(t): NODE under management in the external vault at time t
- S(t): gnode total supply (vault shares) at time t
- R(t) = A(t) / S(t): NODE per gnode conversion rate
- E(t): SY exchange rate used by Pendle for PT/YT, depending on SY flavor

Recommended wiring (mirrors established LSDs):
- External vault is ERC4626 with asset=NODE, shares=gnode
- Pendle uses `PendleERC4626NotRedeemableToAssetSY(yieldToken = external ERC4626)`
- Then: E(t) = totalAssets(yieldToken) / totalSupply(yieldToken) = A(t) / S(t) = R(t)

Example Timeline
1) Initial:
   - A0 = 1,000 NODE, S0 = 1,000 gnode → R0 = 1.00
   - User U deposits 100 gnode into SY → mints 100 SY shares (1:1 at entry)
   - PT/YT created on top of SY

2) Revenue accrual (external):
   - External vault receives +50 NODE revenue → A1 = 1,050; S1 unchanged = 1,000
   - R1 = 1,050 / 1,000 = 1.05
   - Since E(t)=R(t), SY exchange rate increases 5%

3) YT accrual:
   - U holds 100 YT notionals (from prior split). The yield over this period is (E1−E0) * YTNotional = (1.05−1.00) * 100 = 5 gnode
   - Router’s `redeemDueInterestAndRewards` accounts for this and returns gnode-denominated yield via SY

4) Redemption paths:
   - YT-only redemption (ongoing): U calls `redeemDueInterestAndRewards` → receives ~5 gnode in SY terms → redeem SY → gnode
   - Combine PT+YT pre-exp: `redeemPyToSy` returns SY; then SY → gnode
   - Post-exp PT: `exitPostExpToSy` returns SY; then SY → gnode
   - gnode → NODE always goes through your external queue/lock contract

Numerical Walkthrough (two users)
- At t0: A0=1,000; S0=1,000; E0=1.00
- Alice holds 100 SY (or equivalently 100 PT+100 YT after split)
- Bob holds 200 SY (or 200 PT+200 YT)

Revenue +30 NODE at t1:
- A1=1,030; S1=1,000; E1=1.03
- Alice YT accrual: (1.03−1.00)*100 = 3 gnode
- Bob YT accrual: (1.03−1.00)*200 = 6 gnode
- Total YT accrual: 9 gnode matches value added divided proportionally

If another +20 NODE at t2:
- A2=1,050; S2=1,000; E2=1.05
- Additional accrual from t1→t2:
  - Alice: (1.05−1.03)*100 = 2 gnode
  - Bob:   (1.05−1.03)*200 = 4 gnode
  - Total over t0→t2: Alice=5, Bob=10

Key Observation: No SY-side “injection” is needed; as long as E(t) tracks R(t) from the external ERC4626 (asset=NODE, shares=gnode), YT accrues exactly with the NODE-per-gnode increase.

### Different Entry Exchange Rates (Per-User Snapshots)
Scenario:
- E(t) is NODE-per-gnode from the external ERC4626. Assume monotonic increase for simplicity.
- User A mints PT+YT when E_A0 = 1.05 with YT notional N_A = 100
- User B mints PT+YT later when E_B0 = 1.12 with YT notional N_B = 200
- Later, at claim time t1, E_1 = 1.15

Accrual computation (conceptual snapshot model):
- A’s claimable at t1: (E_1 − E_A0) × N_A = (1.15 − 1.05) × 100 = 10 gnode
- B’s claimable at t1: (E_1 − E_B0) × N_B = (1.15 − 1.12) × 200 = 6 gnode

Observations:
- Different entry times see different bases (snapshots). A accrues across 1.05→1.15, B across 1.12→1.15.
- Total YT accrual equals the value added, distributed proportionally over time to whoever was holding YT during each interval.

Claim and snapshot advance:
- When A (or B) calls `redeemDueInterestAndRewards`, the router computes due = (E_now − E_lastSnapshot) × notional, pays out in SY terms (redeemable to gnode), then updates the user’s snapshot Esnapshot := E_now.
- Subsequent accruals start from the new snapshot.

Transfers mid-period:
- If A transfers YT to C before claiming, typical YT implementations settle/update snapshots so that:
  - A’s due interest up to transfer is either claimable or reflected via snapshot accounting
  - C accrues from the post-transfer snapshot E_transfer forward
  - Net effect: yield is attributed to whoever holds YT during each sub-interval

Exits:
- YT-only: users periodically claim via `redeemDueInterestAndRewards` → receive SY → redeem to gnode
- Pre-exp combine: `redeemPyToSy(receiver, YT, netPtIn, netYtIn, minSyOut)`; then SY → gnode
- Post-exp PT: `exitPostExpToSy(receiver, market, netPtIn, ...)`; then SY → gnode
- gnode → NODE always via the external queue/lock contract

## How YT Holders Receive and Redeem Yield
- Accrual: YT’s entitlement is the growth in SY exchange rate E(t) over time multiplied by YT notional. With E(t)=A(t)/S(t), any NODE revenue entering the external vault increases A(t) and thus E(t).
- Redemption:
  - Periodic claim: `redeemDueInterestAndRewards(user,[SY],[YT],[])` returns yield in SY terms that map to gnode upon SY redeem.
  - Combine pre-exp: `redeemPyToSy(receiver, YT, netPtIn, netYtIn, minSyOut)`
  - Post-exp: `exitPostExpToSy(receiver, market, netPtIn, ...)`
- Final asset received from SY: always `gnode`. Unwrapping to NODE uses your external queue/lock.

### Negative Events (Slashing/Penalties)
- If A(t) (NODE under management) decreases due to slashing/penalties, then E(t)=A(t)/S(t) can decrease.
- YT accrual for that interval reflects the actual delta; it can be zero or negative. We do not clamp E(t).
- Such events will be disclosed clearly in UI/announcements; Pendle YT accommodates variable yield.

## If We Instead Set Asset=gnode in an Intermediate Vault
- Then ERC4626.totalAssets = gnode units, and E(t)=gnode-per-share. E(t) won’t move as NODE-per-gnode changes unless extra gnode is donated to the vault. This weakens the direct linkage between NODE accrual and YT value.
- Conclusion: prefer wiring SY to your external ERC4626 (asset=NODE, shares=gnode) using the Not-Redeemable-To-Asset flavor so E(t)=NODE-per-gnode directly.

## Admin / Upgrade Posture (at-a-glance)

| Component        | Admin (multisig) | Timelock | Upgradable (pattern) | Pause Scope                |
|------------------|------------------|----------|-----------------------|----------------------------|
| External ERC4626 | TBD              | TBD      | Yes (UUPS/Proxy)      | Optional (deposits/withdraws)
| gnode (ERC20)  | TBD              | TBD      | Yes/No (TBD)          | None (non-rebasing token)  |
| SY               | Owner (BoringOwnable) | TBD | Typically non-upg      | Pause SY transfers only    |

We will publish final values (addresses, delays) before deployment for reviewer verification.

## Events & Invariants
- Events:
  - External: RevenueAdded(amount), QueueParamsUpdated(...), FeeParamsUpdated(...)
  - Vault (if applicable): Donate(amount)
  - SY: standard Deposit/Redeem events (already emitted by SYBase)
- Invariants:
  - gnode is non-rebasing; yield path is via totalAssets/totalSupply only.
  - SY never transfers NODE to users; tokenOut is always gnode.
  - Queue/lock enforces NODE outflow delays/caps per policy.

## Interfaces / Dev UX
- Consider EIP-2612 `permit` on gnode to ease routing UX.
- Confirm decimals() = 18 on gnode and that SY mirrors share decimals.
- Oracles/UI should use `convertToAssets/convertToShares` (and SY `exchangeRate`) for rates.

## Test Plan (checklist)
- Multi-user, multi-interval accrual: exact ΔE × notional per user using snapshots.
- Deposits/withdraws at different E(t) with rounding behavior as specified.
- Negative A(t) shock: verify E(t) decrease propagates to YT accrual; no clamping.
- Assert SY redeem never returns NODE (only gnode).
- Post-exp PT exits → SY → gnode flow via router.
- Transfers of YT mid-interval settle snapshots correctly.




---

## Corrections & Clarifications (2025‑09‑30)

- **Deposits:** If deposit token is **NODE**, SY immediately deposits into the ERC‑4626 and holds **gnode**; SY never idles raw NODE.
