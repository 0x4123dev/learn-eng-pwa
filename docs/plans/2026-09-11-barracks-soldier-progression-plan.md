# Barracks soldier progression plan

1. Add pure barracks goal/progress rules for the 1, 2, 3, 4, 5, 5… schedule.
2. Preserve `soldierCycles` in normalized layouts and server-authoritatively stamp new/existing barracks; retain a private lineage across UID rotation and delete/recreate requests.
3. On collection, consume only the completed task-days required for the current cycle, increment the cycle, and award exactly one soldier.
4. Show the current soldier number and Daily Task progress in the builder; update shop copy.
5. Add pure, server, layout, offline, UID-reset, and UI regression tests, then run the full suite and verification.
6. Review, commit, deploy to Cloudflare Pages, verify live, and push the release commits.
