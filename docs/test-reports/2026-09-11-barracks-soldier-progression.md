# Barracks soldier progression test report

Status: PASS

- Focused regression suites: 119 tests passed across farm rules, layout normalization, server collection, soldier stock, builder UI, and Night Raid API guards.
- Full release suite on the deployed revision: 12,036 tests passed.
- Source and live feature verification: 286 checks passed; no affected feature detected.
- `git diff --check`: passed.

Coverage includes the single account-wide clock, synchronized one-soldier-per-barracks batches, later-purchase inheritance, the 1/2/3/4/5/5… goals, surplus completed-day carryover, server ownership of `lastDay`, `soldierCycles`, and barracks identity, legacy conversion, delete/recreate reset prevention, offline retry behavior, upgraded-building refunds, the fifth-and-later cap, and visible progress text.
