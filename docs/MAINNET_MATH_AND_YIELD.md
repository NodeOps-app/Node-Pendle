## NodeOps V2 x Pendle — Math and Controlled Yield Playbook (Mainnet)

This document summarizes how the system generates, accounts for, and distributes yield across SY/PT/YT, with concrete formulas and multi-user examples. It also covers controlled yield injection and exit via the `GnodeQueue` (gnode → NODE).

### Components
- `GnodeVault` (ERC-4626): asset = `NODE`, shares = `gnode`. Exchange rate \(E(t)\) in wei: \(E = A/S = totalAssets / totalSupply\).
- `SY` wrapper: wraps `gnode`. Redeem outputs `gnode` only (never `NODE`). `SY.exchangeRate()` mirrors vault \(E\).
- Pendle: `PT` (principal), `YT` (yield) for a given maturity. `PT` redeems 1:1 to `SY` at maturity; `YT` accrues yield until maturity and then is economically 0.
- `GnodeQueue`: delayed, rate-limited off-ramp `gnode → NODE`.

---

### 1) Exchange Rate and Value Accounting
Let:
- \(A\) = `vault.totalAssets()` in `NODE`
- \(S\) = `vault.totalSupply()` in `gnode`
- \(E\) = \(A/S\) in 1e18 precision

Key invariants:
- Deposits/withdraws at fair value keep \(E\) stable.
- Donations (yield injections) change \(A\) without changing \(S\) → \(E\) increases.
- Slashing/bad events reduce \(A\) → \(E\) decreases.

Conversions:
- `gnode` value in `NODE`: `gnodeAmount * E / 1e18`.
- `SY` shares map 1:1 to `gnode`; `SY.exchangeRate() = E`.

Sizing a donation to reach a target rate \(E_{target}\):
\[ \Delta A = S * (E_{target} - E_{now}) / 1e18 \]

Example: \(S=10,000\) shares, \(E_{now}=1.05e18\), target \(1.10e18\) ⇒ \(\Delta A = 10,000 * 0.05e18 / 1e18 = 500\) `NODE`.

---

### 2) YT Accrual Math (Per-User Snapshots)
Each YT holder accrues yield proportional to their `YT notional` times the change in \(E\) since their last snapshot.

For user \(i\):
- On mint/snapshot: store \(E_{i,0}\)
- Claimable (in `SY` terms equivalent to `gnode`) at time \(t\):
\[ claimable_i = N_i * \max(E(t) - E_{i,0}, 0) / 1e18 \]
After claim, set \(E_{i,0} := E(t)\).

Multi-user example:
- Start: \(E=1.00\), no YT supply.
- Alice mints `YT=100` at \(E=1.05\) → stores \(E_{A,0}=1.05\).
- Bob mints `YT=200` at \(E=1.12\) → stores \(E_{B,0}=1.12\).
- Later, \(E=1.15\):
  - Alice: \((1.15-1.05)*100 = 10\) (in `gnode`-equiv SY)
  - Bob: \((1.15-1.12)*200 = 6\)

Transfers settle snapshots so that the holder at each sub-interval accrues the corresponding \(\Delta E\) on their notional.

---

### 3) Controlled Yield Injection (Design and Sizing)
Goal: add \(\Delta A\) `NODE` to the vault so that YT holders earn a planned distribution while keeping \(E\) within policy bounds.

Given current \(S\), \(E_{now}\) and a desired aggregate YT payout \(D\) (in `gnode`-equiv SY):
\[ E_{target} = E_{now} + D / S * 1e18 \]
\[ \Delta A = S * (E_{target} - E_{now}) / 1e18 = D \]
Thus a donation of \(D\) `NODE` raises \(E\) so that the sum of user claims equals \(D\) (subject to snapshot timing and any transfers).

Practical guardrails:
- Stage injections (e.g., daily) and observe realized claims before the next tranche.
- Cap \(E\) step: \(E_{target} - E_{now} \le \epsilon\) to avoid shocks.
- Verify after each donation: \(A\) increased by exactly donation, \(S\) unchanged; recompute \(E\).

Numerical scenario:
- \(S=1,000,000\), \(E=1.2000\), policy: inject \(D=20,000\) `NODE` weekly.
- Donation → \(E_{new} = 1.2000 + 20,000/1,000,000 = 1.2200\).
- A user with `YT=50,000` and last snapshot \(1.2000\) can claim \((1.2200-1.2000)*50,000 = 1,000\) (in `gnode`-equiv SY).

---

### 4) PT, YT, and Market Behavior at/near Maturity
- PT converges to 1 SY; at/after maturity, use router’s post-expiry exit to redeem PT → SY.
- YT accrual stops at maturity; call `redeemDueInterestAndRewards` to claim remaining yield; YT then has no future value.
- AMM liquidity: bootstrap with dual-sided `PT+SY`. Use single-sided adds only once LP exists. Enforce preflight (staticCall) and quotes to size `netSyIn/netPtIn`.

---

### 5) Off-Ramp via `GnodeQueue` (gnode → NODE)
Parameters:
- `minDelay`: minimum wait (seconds) from request to claim.
- `epochSize`: length of each capacity window.
- `epochOutflowLimit`: NODE cap per epoch.

Flow:
1. User approves `gnode → GnodeQueue`.
2. `requestRedeem(shares)` → records `{shares, earliest, user, claimed=false}` and transfers `gnode` to queue.
3. After `earliest` and if `epochOutflowUsed + previewRedeem(shares) ≤ epochOutflowLimit`, user calls `claim(id, minAssetsOut)`:
   - Queue redeems `shares` from the vault to `NODE` for the user, increases `epochOutflowUsed`, marks `claimed`.

Timing and capacity examples:
- Example A: `minDelay=1h`, `epochSize=24h`, `limit=10,000 NODE`.
  - Alice requests 1,000 `gnode` at 09:00; \(E=1.20\) → preview `NODE≈1,200`; earliest 10:00.
  - At 10:00, if `epochOutflowUsed + 1,200 ≤ 10,000`, claim executes.

Multiple users across epochs:
- Morning: `used=9,000`. Bob (1,200 expected) hits the cap → must wait next epoch when `used` resets to 0.

Operational notes:
- UI should display `earliest`, `epochOutflowLimit - epochOutflowUsed`, and next epoch time.
- Use `getUserRequestIds(user)`/`getUserPendingRequestIds(user)` to list requests (added in latest upgrade).

---

### 6) Safety and Ops Checklist (Mainnet)
- Addresses
  - `VAULT_ERC4626.asset() == NODE` (strict)
  - `SY.exchangeRate() == A/S` (spot check)
- Donations
  - Approve `NODE → VAULT_ERC4626`; call `donateRevenue(amount)`.
  - Verify: `totalAssets ↑ by amount`, `totalSupply` unchanged, `E ↑`.
  - Stage injections; cap \(\Delta E\) per window.
- YT claims
  - Provide preview via RouterStatic or client formula \(N * \max(E - E_{snap},0)\).
- AMM liquidity
  - Bootstrap with dual `PT+SY` (preflight with staticCall), then allow single-SY adds.
  - Ensure market’s `readTokens().SY` equals your `SY_ADDRESS`; preflight rate checks.
- Queue
  - Set sensible `minDelay/epochSize/epochOutflowLimit`. Monitor `epochOutflowUsed`.

---

### 7) Appendix — Quick Formulas
- Donation needed to lift rate to \(E_{target}\): \(\Delta A = S * (E_{target} - E_{now}) / 1e18\).
- Aggregate donation to pay \(D\) (in `NODE`) to current YT: set \(E_{target} = E_{now} + D / S * 1e18\).
- User YT claim \(= N * \max(E - E_{snap},0) / 1e18\).

These identities assume no fee-on-transfer behavior and fair-value SY behavior; if using tokens with transfer fees or non-standard hooks, adjust accounting accordingly.


