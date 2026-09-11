# Barracks soldier progression decision

All barracks on one account share one training clock, led by the first barracks. A later purchase immediately joins the same `soldierCycles` and `lastDay`; there are no separate progress tracks to monitor.

The next synchronized batch requires `min(soldierCycles + 1, 5)` completed Daily Task days: 1, 2, 3, 4, then 5 for every later batch. Extra completed days remain banked. When ready, clicking any barracks collects the whole batch: each owned barracks contributes one soldier, and the shared cycle advances once.

On migration, the original/first barracks becomes authoritative; later barracks are synchronized to it. The server owns the shared fields in a private `__barracksTraining` record that remains absent from normalized client/API layouts. Removing every barracks does not remove this clock, so rebuilding or changing UIDs cannot reset the schedule.

Because soldiers and the shared clock are server-authoritative, an offline collection leaves the batch ready and asks the player to retry. It must never display temporary local soldiers that disappear on the next sync.
