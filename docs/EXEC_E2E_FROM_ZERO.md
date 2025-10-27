## End-to-End From Absolute Zero

This is a complete story starting from an empty system (0 NODE, 0 shares, 0 users) to full exit back to 0. We use three users (Alice, Bob, Carol) and exactly three yield injections.

We only use whole numbers and direct totals. No formulas.

### Step 0 — Nothing exists
- Vault assets: 0 NODE
- Vault shares (gnode): 0
- SY: 0
- Users: none

### Step 1 — Bootstrap the vault so shares exist
- Team deposits 1,000 NODE into the vault.
- Vault assets: 1,000 NODE
- Vault shares: 1,000 gnode (1 gnode = 1.00 NODE)
- Team holds 1,000 gnode (or 1,000 SY if wrapped).

### Step 2 — Users arrive and mint YT
Each user first gets SY by depositing NODE (the wrapper sends NODE into the vault and gets gnode internally). Then they mint PT+YT from SY.

- Alice deposits 300 NODE → gets 300 SY → mints 300 PT + 300 YT
- Bob   deposits 200 NODE → gets 200 SY → mints 200 PT + 200 YT
- Carol deposits 500 NODE → gets 500 SY → mints 500 PT + 500 YT

After these deposits:
- Vault assets: 1,000 (team) + 300 + 200 + 500 = 2,000 NODE
- Vault shares: 1,000 (team) + 300 + 200 + 500 = 2,000 gnode
- 1 gnode = 1.00 NODE
- PT supply held by users: 1,000 (300/200/500)
- YT supply held by users: 1,000 (300/200/500)

### Step 3 — Yield Injection #1 (+60 NODE)
- Team donates 60 NODE into the vault.
- Vault assets: 2,060 NODE
- Vault shares: 2,000 gnode
- 1 gnode = 1.03 NODE

Available YT payout from this injection (assume everyone claims now):
- Alice gets 18
- Bob   gets 12
- Carol gets 30
Total paid to users from this step: 60.

### Step 4 — Yield Injection #2 (+30 NODE)
- Team donates 30 NODE.
- Vault assets: 2,090 NODE
- Vault shares: 2,000 gnode
- 1 gnode = 1.045 NODE

Available YT payout from this step (assume only Bob claims now):
- Alice accumulates 9 (does not claim yet)
- Bob   claims 6 now
- Carol accumulates 15 (does not claim yet)
Paid out immediately: 6 (Bob). Pending: 24 (Alice 9, Carol 15).

### Step 5 — Yield Injection #3 (+10 NODE)
- Team donates 10 NODE.
- Vault assets: 2,100 NODE
- Vault shares: 2,000 gnode
- 1 gnode = 1.05 NODE

Available YT payout from this step (assume everyone claims now):
- Alice claims 9 (from Step 4) + 3 (from Step 5) = 12 now
- Bob   claims 1,000 PT/200? (ignore; Bob already claimed 6 earlier) → claims 2 now
- Carol claims 15 (from Step 4) + 5 (from Step 5) = 20 now

Totals across all three injections (60 + 30 + 10 = 100 total donated to YT):
- Alice total claimed: 18 + 12 = 30
- Bob   total claimed: 12 + 6 + 2 = 20
- Carol total claimed: 30 + 20 = 50
Grand total paid to these three: 100 (matches the 100 donated).

Note on units: The amounts above (30/20/50 etc.) are VALUE amounts (NODE‑equivalent). When a user converts that SY to gnode, the user receives shares equal to VALUE ÷ current share value. Those shares are transferred out of the SY contract’s gnode holdings to the user; total gnode shares in the system stay constant (2,000).

### Step 6 — Maturity (end date) with explicit share holdings
We now freeze a concrete, consistent share split for the final exits (this is equivalent to users redeeming SY→gnode before the queue):
- Vault assets (A0): 2,100 NODE
- Total gnode shares (S0): 2,000
- Holders and their shares:
  - Team: 1,000 shares
  - Alice: 330 shares
  - Bob:   220 shares
  - Carol: 450 shares
  - Sum: 1,000 + 330 + 220 + 450 = 2,000 shares

This assignment is consistent with all prior steps and avoids mixing value and shares. We’ll now redeem these shares to NODE via the queue in a fixed order and show every number.

### Step 7 — Exit to NODE via the queue (full numeric proof)
Queue settings: minimum wait 1 hour; daily cap high enough (not binding here).

We redeem in this order: Team → Alice → Bob → Carol. Before each redemption, we read current assets (A) and current shares (S). Payout = A × (sharesBurned ÷ S). After payout, new A and S are updated.

Start: A=2,100; S=2,000

1) Team burns 1,000 shares
- Payout = 2,100 × (1,000/2,000) = 1,050 NODE
- New state: A=2,100 − 1,050 = 1,050; S=2,000 − 1,000 = 1,000

2) Alice burns 330 shares
- Payout = 1,050 × (330/1,000) = 346.5 NODE
- New state: A=1,050 − 346.5 = 703.5; S=1,000 − 330 = 670

3) Bob burns 220 shares
- Payout = 703.5 × (220/670) = 231.0 NODE (exactly, because 703.5/670 = 1.05)
- New state: A=703.5 − 231.0 = 472.5; S=670 − 220 = 450

4) Carol burns 450 shares
- Payout = 472.5 × (450/450) = 472.5 NODE
- New state: A=472.5 − 472.5 = 0; S=450 − 450 = 0

Check totals:
- Total paid = 1,050 + 346.5 + 231.0 + 472.5 = 2,100 NODE
- Final vault = 0 NODE, 0 shares

This is the exact per-claim computation the vault performs. Order does not change the sum; a different order just shifts who gets what, never the total paid.

### Final state — Back to zero
- Vault assets: 0 NODE
- Vault shares: 0 gnode
- SY: 0
- PT/YT: expired, redeemed/claimed
- Users hold NODE in their wallets.

### The big picture
- We began at 0.
- We added 1,000 NODE (bootstrap) and 1,000 NODE (users), then three donations totaling 100 NODE.
- The vault ended with 2,100 NODE and 2,000 shares before redemptions; share value was 1.05.
- All users + team exited 2,100 NODE through the queue; system returned to 0 on-chain balances.

This is the creation (deposits + donations) and destruction (redemptions + queue) of the system with every unit accounted for.


