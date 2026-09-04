# Daily-task seed rewards implementation plan

1. Add migration `db/028-farm-seed-rewards.sql` and mirror it in `db/schema.sql`.
2. Extend `_daily-task.js` with the crop cycle, idempotent two-day ledger evaluation, inventory status, and reward history.
3. Return seed status from Daily Task and Night Raid home APIs.
4. Add authenticated `night-raid/plant` endpoint; block newly minted crop cells in generic home PUT.
5. Update Daily Task UI with clear two-day progress, next reward, recent rewards, and seed-inventory navigation.
6. Remove Seeds from Shop, add a peer-level Seeds menu, render owned quantities, and plant through the server without charging coins.
7. Add server, client, schema, and builder regression tests; run the full suite.
8. Apply migration 028 to production D1, then deploy Cloudflare Pages and verify live assets/API version.
