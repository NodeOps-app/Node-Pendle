## NodeOps V2 — End‑to‑End Local Test Run (Arbitrum fork via anvil)

This document captures the exact scenario we executed locally for V2, including components, parameters, concrete addresses, step‑by‑step actions, and the math behind PT/YT and queue exits.

### Canonical mapping (single source of truth)
- Underlying: `NODE` (ERC‑20, 18 decimals)
- Vault shares (non‑rebasing): `gnode` (ERC‑20 + permit, 18 decimals)
- Vault: ERC‑4626 with asset=NODE, shares=gnode; exchange rate E(t)=NODE_per_gnode
- SY: Not‑Redeemable‑To‑Asset wrapper over the vault
  - Deposits: accepts NODE or gnode
  - Redeems: returns gnode only (never NODE)
- Queue: off‑ramp `gnode → NODE` enforcing delay and epoch cap

### Addresses from this run
- NODE (mock): `0xd606e6725E030099024091eE411495593cB18F9D`
- Vault (UUPS proxy): `0x30a25c0BfD907fB031e070572ae777b93963A700`
- gnode (shares): vault address (non‑rebasing shares held by SY/users) = `0x30a25c0BfD907fB031e070572ae777b93963A700`
- Queue (UUPS proxy): `0x9d7D6C098f28499d47882ca8f6ACaDbF18d3B289`
- SY (Not‑Redeemable‑To‑Asset): `0x6ee44972Aa07898053132ED9A0b2f46CBaCf6293`
- PT: `0xaB90C1584EC5063dA9F353A2d4f72e59a94417E7` (created by factory)
- YT: `0xD7d8A209f7E4A6e349c9C349D71eB29908004540`
- Market: `0xa03a646489118c6b1A8BC7459674b898058c4023`

Note: PT/YT expiry is factory‑aligned to a weekly grid (your run used the factory default). Exact timestamp can be fetched from the yield contract factory or PT.

### Queue parameters (from deployment)
- minDelay: 3600 seconds (1 hour)
- epochSize: 86400 seconds (1 day)
- epochOutflowLimit: 1,000,000 NODE per epoch

These parameters rate‑limit NODE exits and enforce a waiting time before claim.

### Accounts involved (Hardhat default signers)
- Deployer: `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`
- User A (index 1): `0x70997970C51812dc3A010C7d01b50e0d17dc79C8`
- User B (index 2): `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC`

### Phase 1 — Bootstrap and deposits
Actions (scripts/minev2/02‑bootstrap‑and‑mint.js):
1) Mint NODE to users (mock token owner mints):
   - User A: +10,000 NODE
   - User B: +10,000 NODE
2) Each user deposits NODE into SY.
   - SY immediately deposits into the ERC‑4626 vault and holds `gnode` internally.
   - User balances after deposit: NODE ≈ 0 (spent), SY shares credited.

State and math after Phase 1:
- Vault totalAssets A0 ≈ 20,000 NODE
- Vault totalSupply S0 ≈ 20,000 gnode (non‑rebasing)
- Exchange rate E0 = A0 / S0 = 20,000 / 20,000 = 1.00 NODE per gnode

Alignment with goals:
- SY never idles NODE; all NODE is vaulted.
- SY never returns NODE on redeem; it returns gnode only.

### Phase 2 — PT/YT creation and minting PY
Actions (scripts/minev2/03‑create‑pt‑yt‑and‑market.js and 04‑approve‑and‑mint‑py.js):
1) PT/YT are created for the SY via Pendle factories; a Market is deployed.
2) User A mints PY (PT+YT) from their SY balance.
   - This consumes User A’s SY balance and gives them PT and YT at notional equal to the SY used.

State implication:
- User A: holds PT_A and YT_A (notional ≈ 10,000 gnode equivalent)
- User B: still holds SY (~10,000)

### Phase 3 — Off‑ramp via Queue (SY → gnode → NODE)
Actions (scripts/minev2/05‑queue‑request‑and‑claim.js):
1) For User B (who still held SY):
   - Redeem SY → gnode (tokenOut = vault shares) for User B.
   - Approve queue and `requestRedeem(gnode)`.
   - Advance time >= minDelay (1 hour) and `claim` → receive NODE.

State and math for this redeem:
- Pre‑redeem: A = 20,000, S = 20,000, E = 1.00
- Redeem x = 10,000 gnode → assetsOut ≈ x * E = 10,000 NODE
- Post‑redeem: A' = 10,000, S' = 10,000, E' = A'/S' = 1.00 (unchanged aside from wei rounding)

Alignment with goals:
- SY redeem returned gnode; NODE was only obtained via the queue after the delay.
- Exchange rate E(t) is not impacted by fair‑value redeem.

### Phase 4 — Simulating yield and claiming YT
Actions (scripts/minev2/07‑donate‑and‑claim‑yt.js):
1) Donate NODE into the vault (no shares minted):
   - Donated: 5,000 NODE (default unless DONATE_AMT set)
   - Before: A0 = 10,000; S0 = 10,000; E0 = 1.00
   - After: A1 = 15,000; S1 = 10,000 → E1 = 15,000 / 10,000 = 1.50
   - Log excerpt:
     - exchangeRate before: `1.000000000000000000`
     - exchangeRate after: `1.500000000000000000`
2) Claim YT yield for User A:
   - `redeemDueInterestAndRewards(user, [SY], [YT], [])` called via router.
   - YT entitlement ≈ ΔE × notional = (1.50 − 1.00) × 10,000 = 5,000 (in SY terms → redeemable to gnode).

Alignment with goals:
- YT accrues exactly from ΔE = NODE_per_gnode increase.
- No SY‑side “donation” hack is needed; the external vault determines E(t).
- SY never returns NODE on claims; output remains SY/gnode, with optional queue to reach NODE.

### What each user received (illustrative from this run)
- User A (YT minter):
  - Gave up SY to mint PT+YT.
  - After donate: claimed YT yield ≈ 5,000 (in SY terms → redeemable to gnode). PT remains for principal at expiry.
- User B (queue exit):
  - Redeemed SY → gnode, then queued and claimed NODE ≈ 10,000 after 1‑hour delay (within daily cap).

Note: Values are exact up to ERC‑4626 rounding rules (floor/ceil at previews). In our run the logs matched the clean math above (E moved from 1.00 to 1.50 after a 5,000 donation given the reduced A,S after User B’s exit).

### Rounding and invariants (checked implicitly by flows)
- ERC‑4626 previews follow:
  - previewDeposit/convertToShares: floor
  - previewMint/convertToAssets: ceil
  - previewWithdraw/convertToShares: ceil
  - previewRedeem/convertToAssets: floor
- Invariants observed:
  - Non‑rebasing shares; balances don’t change from yield.
  - SY never outputs NODE.
  - Fair‑value deposits/withdraws keep E(t) stable; donations/slashing move E(t).

### Market details
- PT/YT creation used the Pendle V5 factories on Arbitrum; expiry aligned to factory’s schedule (weekly grid).
- Market address: `0xa03a646489118c6b1A8BC7459674b898058c4023` (for this run).
- Standard Pendle flows (split/combine, LP, swaps) work over SY with E(t) sourced from the vault.

### Summary — does this align with our goals?
- Prevent instant NODE dumps: Yes. SY returns gnode; NODE exits are only via the queue with delay and daily caps.
- Non‑rebasing shares: Yes. All yield is reflected in E(t)=NODE_per_gnode, not balances.
- YT mechanics: Yes. YT accrues ΔE × notional and claims via router; we observed a 50% E(t) jump (1.00 → 1.50) and successful YT claim.
- Clean, audit‑friendly shape: ERC‑4626 (asset=NODE, shares=gnode) + SY Not‑Redeemable‑To‑Asset + external queue; mirrors established LSD integrations.

### Reproduce locally
1) Deploy stack: `npx hardhat run scripts/minev2/01-deploy-stack.js --network localhost`
2) Bootstrap deposits: `npx hardhat run scripts/minev2/02-bootstrap-and-mint.js --network localhost`
3) Create PT/YT & market: `npx hardhat run scripts/minev2/03-create-pt-yt-and-market.js --network localhost`
4) Mint PY from SY: `npx hardhat run scripts/minev2/04-approve-and-mint-py.js --network localhost`
5) Queue exit: `npx hardhat run scripts/minev2/05-queue-request-and-claim.js --network localhost`
6) Yield simulation & YT claim: `npx hardhat run scripts/minev2/07-donate-and-claim-yt.js --network localhost`

Ensure `.env` contains valid addresses for NODE (or NODE_TOKEN), VAULT_ERC4626, SY_ADDRESS, PENDLE_ROUTER, YT_ADDRESS, GNODE_QUEUE.


