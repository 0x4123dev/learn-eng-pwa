# Barracks soldier progression test report

Status: PASS

- Focused regression suites: 103 tests passed across farm rules, layout normalization, server collection, builder UI, and Night Raid API guards.
- Full release suite after rebasing onto the latest master: 12,029 tests passed.
- Feature verification: 269 checks passed; no affected feature detected.
- `git diff --check`: passed.

Coverage includes the 1/2/3/4/5/5… goals, surplus completed-day carryover, server ownership of `lastDay`, `soldierCycles`, and barracks identity, legacy barracks conversion, delete/recreate reset prevention, offline retry behavior, the fifth-and-later cap, and visible progress text.
