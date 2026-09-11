# Barracks soldier progression plan

1. Add pure barracks goal/progress rules for the 1, 2, 3, 4, 5, 5… schedule.
2. Store one private, server-authoritative `soldierCycles`/`lastDay` clock per account and stamp it onto every existing or newly purchased barracks.
3. On collection, consume only the completed task-days required for the shared cycle, increment it once, and award one soldier per owned barracks.
4. Show identical progress on every barracks and explain the shared clock in the shop.
5. Add pure, server, layout, offline, UID-reset, multi-barracks, later-purchase, and UI regression tests, then run the full suite and verification.
6. Review, commit, deploy to Cloudflare Pages, verify live, and push the release commits.
