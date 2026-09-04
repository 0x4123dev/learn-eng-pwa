# Daily-task seed rewards decision

## Outcome

- Seeds are no longer sold for coins or shown as a Shop category.
- Each GMT+7 day on which all assigned Daily Tasks are completed advances a server-owned two-day seed streak.
- Two consecutive completed days award exactly one seed. The next pair starts again at zero; a missed day breaks an unfinished pair.
- Rewards rotate through `FarmRules.CROPS` in order and wrap after pumpkin.
- Existing 200-coin and shield/sword rewards remain unchanged; seeds are an additional farm reward.
- The server stores the completion ledger, awarded crop, and per-crop inventory. Planting consumes one seed atomically with saving the new crop.
- Daily Task shows `0/2` or `1/2`, the next seed, recent awards, and a route to the seed inventory.
- Builder navigation has a peer-level Seeds icon. It opens inventory cards with quantities and planting actions; Shop contains only defenses, farm decorations, and expansion.

## Safety

- The client cannot create a new crop through the generic home PUT.
- The dedicated plant endpoint validates ownership, crop id, target board, free space, and inventory.
- One `(user, task_date)` ledger row and conditional inventory updates make evaluation and repeat taps idempotent.
