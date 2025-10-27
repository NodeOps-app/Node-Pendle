## Executive Summary — How Yield Works Here (Plain Numbers)

This explains what the product does with straight numbers, no math symbols.

### What the system does
- We put the base asset (NODE) into a vault. The vault issues shares called gnode.
- One gnode is worth some amount of NODE. Example: if the vault holds 1,200,000 NODE and there are 1,000,000 gnode, then 1 gnode = 1.20 NODE.
- We wrap gnode into SY so Pendle can tokenize it into two tokens:
  - PT (principal): turns back into SY 1:1 at the end date.
  - YT (yield): earns the increase in gnode’s value until the end date.

### Concrete setup (Day 0)
- Vault has 1,200,000 NODE.
- There are 1,000,000 gnode.
- Therefore: 1 gnode (and 1 SY) = 1.20 NODE.
- Users mint YT:
  - Alice holds 100,000 YT.
  - Bob holds 50,000 YT.
  - Carol holds 150,000 YT.

Total YT notional in this example = 300,000.

### What a “yield injection” does in numbers
- The team donates 24,000 NODE into the vault (no new shares are created).
- New vault assets: 1,200,000 + 24,000 = 1,224,000 NODE.
- Shares remain 1,000,000, so now 1 gnode = 1,224,000 / 1,000,000 = 1.224 NODE.
- Bottom line: the vault got 24,000 NODE richer; that 24,000 is now claimable by YT holders.

Who gets how much from this 24,000?
- Alice has 100,000 YT → she can claim 2,400 (24,000 × 100,000 / 1,000,000).
- Bob has 50,000 YT → 1,200.
- Carol has 150,000 YT → 3,600.
- If someone transfers YT before claiming, the current holder at claim time gets the amount; the system tracks this automatically.

### Doing this as smaller daily drips
Instead of 24,000 once, do 4,000 per day for 6 days.
- Each day, the vault’s assets go up by 4,000.
- Each day, YT holders can claim their share of 4,000.
- Example: with the same holdings, day‑1 claims are Alice 400, Bob 200, Carol 600.

Guideline: Keep each daily donation small enough to avoid surprises. A good starting point is “no more than ~1–2% of the vault’s assets per day,” then adjust based on user feedback.

### What happens at the end date (maturity)
- PT: 1 PT becomes 1 SY. Users swap PT → SY through the router’s “post‑expiry exit” button/flow.
- YT: stops earning new yield. Users should press “Claim YT” once to collect anything left, then YT has no ongoing value.

### Getting back to NODE (how users actually exit)
1) SY → gnode: instant. Users redeem SY and receive gnode one‑for‑one.
2) gnode → NODE: via our queue with a wait and a daily cap. Example parameters:
   - Minimum wait time: 1 hour.
   - Daily cap (per rolling 24h): 50,000 NODE.

Example timeline with the queue
- Carol submits a request to convert 10,000 gnode at 09:00.
- Current share value is 1.224 NODE, so she’s entitled to about 12,240 NODE.
- Her “earliest claim time” is 10:00 (1‑hour wait).
- If the cap has room when she clicks “Claim” after 10:00, she receives ~12,240 NODE immediately, and that counts against the 50,000 daily cap.
- If the cap is already used up, the app shows “Try again in the next window,” and Carol can claim after the cap resets.

### Liquidity in the PT–SY market (how trading works)
- To start a new market, we seed it with both PT and SY once (a “dual add”). After that, users can also add just SY and the router balances it.
- If a single‑sided add says “no existing LP,” it means the pool hasn’t been seeded yet—do a one‑time dual add.

### What to watch operationally (simple checks)
- After each donation: vault assets go up by exactly the donation amount, number of shares stays the same, and the value per share goes up.
- Before adding liquidity: the market must be active (not past the end date), and the SY being used must match the market.
- For the queue: show a timer (“Claim available after HH:MM”) and a remaining capacity bar (“XX,XXX NODE left today”).

### One‑page plan for controlled injections
1) Pick a target for the month, e.g., “we’ll inject 120,000 NODE this month.”
2) Drip it out, e.g., 4,000 per day on 30 days, or 6,000 per day on 20 days.
3) After each drip, check yesterday’s claims and community reaction; adjust tomorrow’s number up/down.
4) Keep daily drips modest (start ~1–2% of vault assets per day). If users aren’t claiming much, slow down; if claims spike and users are happy, maintain pace.

This turns the system into a predictable, controllable yield engine where management chooses “how much per day,” and users see straightforward claim amounts after each drip.


