## End-to-End Walkthrough (All Numbers, No Variables)

This is a single story from Day 0 to market end. It shows exactly how much NODE goes in, how much YT pays out, how much gnode is redeemed, and how users exit to NODE through the queue.

### Day 0 — Start
- Vault holds 1,000,000 NODE.
- There are 1,000,000 gnode shares.
- Therefore: 1 gnode (and 1 SY) = 1.00 NODE.

Users mint YT (example holdings):
- Alice: 200,000 YT
- Bob:   100,000 YT
- Carol: 200,000 YT

Total YT in this example: 500,000.

### Yield Injection 1 — +25,000 NODE
- We donate 25,000 NODE to the vault. Shares stay the same; assets go up.
- New vault assets: 1,025,000 NODE.
- 1 gnode = 1.025 NODE.

YT payout now available (we’ll assume they all claim immediately for clarity):
- Alice: 5,000 (25,000 × 200,000 / 1,000,000)
- Bob:   2,500
- Carol: 5,000

What they receive on claim: SY that can be redeemed to gnode 1:1. If they press “Redeem SY → gnode” immediately, they get the same numbers above in gnode shares (5,000 / 2,500 / 5,000 gnode). Vault assets do not change when they redeem SY → gnode.

### Yield Injection 2 — +15,000 NODE
- Donate 15,000 NODE.
- Vault assets: 1,040,000 NODE.
- 1 gnode = 1.040 NODE.

YT payout now available (assume only Bob claims now):
- Alice: 3,000 (accumulates but she does not claim yet)
- Bob:   1,500 (claims now)
- Carol: 3,000 (accumulates)

### Yield Injection 3 — +10,000 NODE
- Donate 10,000 NODE.
- Vault assets: 1,050,000 NODE.
- 1 gnode = 1.050 NODE.

YT payout now available (assume everyone claims now):
- Alice: +2,000 (from this step) + previous 3,000 = 5,000 total pending → claims 5,000
- Bob:   +1,000 (from this step) (he already claimed the 1,500 from step 2) → claims 1,000
- Carol: +2,000 (from this step) + previous 3,000 = 5,000 total pending → claims 5,000

Totals across the three injections (25k + 15k + 10k = 50k):
- Alice claimed: 5,000 (step 1) + 5,000 (steps 2+3) = 10,000
- Bob   claimed: 2,500 (step 1) + 1,500 (step 2) + 1,000 (step 3) = 5,000
- Carol claimed: 5,000 (step 1) + 5,000 (steps 2+3) = 10,000

Sum paid to this trio: 25,000. The rest of the 50,000 goes to other YT holders in the market (not shown here). In aggregate across all YT holders, the total paid out equals the 50,000 NODE that we donated (ignoring tiny rounding).

Note: when users press “Redeem SY → gnode”, they simply convert their claim into gnode shares. Vault assets and shares do not change at that moment.

### Maturity — End of Market
- PT stops trading toward the end; at maturity, users redeem PT → SY (1 PT = 1 SY), then SY → gnode.
- YT stops earning new yield. Users press “Claim YT” one last time to pick up whatever was left.

### Off-Ramp — gnode → NODE via Queue (Numbers)
Queue parameters (example):
- Minimum wait: 1 hour.
- Daily cap: 50,000 NODE (resets every 24h window).

Continuing with Alice, Bob, Carol, suppose each decides to off-ramp the gnode they received from YT claims.
- Final share value: 1 gnode = 1.050 NODE.
- Alice has 10,000 gnode from YT claims.
- Bob   has 5,000 gnode from YT claims.
- Carol has 10,000 gnode from YT claims.

They submit requests:
- Alice requests 10,000 gnode at 09:00 → earliest claim 10:00 → entitled to about 10,500 NODE.
- Bob   requests 5,000  gnode at 09:05 → earliest 10:05 → about 5,250 NODE.
- Carol requests 10,000 gnode at 09:10 → earliest 10:10 → about 10,500 NODE.

At claim time, if capacity remains:
- 10:00 Alice claims → queue redeems 10,000 gnode from the vault and sends ~10,500 NODE.
- 10:05 Bob   claims → sends ~5,250 NODE.
- 10:10 Carol claims → sends ~10,500 NODE.

Daily cap accounting:
- After these three, used = 10,500 + 5,250 + 10,500 = 26,250 of 50,000 → still capacity left for others.

What happened to the vault by the end?
- We injected 50,000 NODE over three steps.
- In aggregate, YT holders claimed amounts totaling 50,000 worth of value and, when they off-ramp gnode → NODE, roughly that 50,000 flows out of the vault (timing can shift the exact figure by tiny rounding; the principle is: donations in ≈ claims out over time).
- The principal that users put in (represented by PT at the start) is returned separately on PT redemption at maturity; that’s distinct from the YT claim flow above.

### What management should remember
- If you donate 20,000 NODE today, plan for roughly 20,000 worth of claimable yield across YT holders (split by who holds how much YT at that moment).
- For predictability, split donations into small daily amounts (e.g., 4,000 per day) and adjust day‑to‑day based on usage and sentiment.
- The queue guarantees orderly exits to NODE: there’s a small wait and a daily cap so outflows are controlled.


