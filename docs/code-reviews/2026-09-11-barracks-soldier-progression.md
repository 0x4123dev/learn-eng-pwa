# Barracks soldier progression code review

Status: APPROVED

The final review found no remaining correctness or security issue in scope.

- Progressive goals are 1, 2, 3, 4, then 5 completed Daily Task days for every later soldier.
- The server owns barracks identity, `lastDay`, and `soldierCycles`.
- Rotated, missing, and delete-then-recreate UIDs retain their server-side lineage and cannot reset the cost.
- UID-less legacy barracks keep their progress during migration.
- Offline collection never grants or consumes a temporary soldier; the player is told to retry.
- The private lineage ledger is preserved by home sync, collection, and planting, and is not exposed in normalized API layouts.

Verification reviewed: 28 farm-server tests, 13 layout tests, 34 builder tests, and `git diff --check` all passed. The release validation on the latest master later completed with 12,029 tests and 269 feature checks passing.
