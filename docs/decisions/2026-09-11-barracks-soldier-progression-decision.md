# Barracks soldier progression decision

The training cost belongs to each barracks, not to the account-wide soldier stock. A barracks records how many soldiers it has already produced in `soldierCycles` and how many completed Daily Task days it has already consumed in `lastDay`.

The next soldier requires `min(soldierCycles + 1, 5)` completed Daily Task days: 1, 2, 3, 4, then 5 for every later soldier. Extra completed days remain banked when a soldier is collected, so delayed collection never discards learning progress.

Existing barracks start the new progression at cycle zero. Their existing `lastDay` remains the baseline, preserving whether the old rule already owes them one task-day. The server owns both fields and the barracks identity, and ignores client attempts to rewind, inflate, rotate, or delete/recreate them to reset the schedule. A private lineage ledger in the stored home layout survives removal while remaining absent from normalized client/API layouts.

Because soldiers and their counters are server-authoritative, an offline collection leaves the soldier ready and asks the player to retry. It must never display a temporary local soldier that disappears on the next sync.
