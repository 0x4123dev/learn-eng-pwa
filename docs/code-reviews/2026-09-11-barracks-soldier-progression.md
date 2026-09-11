# Barracks soldier progression code review

Status: APPROVED

The final review found no remaining correctness or security issue in scope.

- All barracks use one account-wide training clock; a later purchase joins the first barracks immediately.
- Progressive shared batches cost 1, 2, 3, 4, then 5 completed Daily Task days forever; each owned barracks contributes one soldier to a ready batch.
- The server owns barracks identity, `lastDay`, and `soldierCycles`; client fields cannot rewind the clock.
- Rotated, missing, delete-then-recreate, and UID-less legacy cases retain the shared progress.
- Offline collection never grants or consumes a temporary soldier; the player is told to retry.
- The private shared clock is preserved by home sync, collection, and planting, and is not exposed in normalized API layouts.
- Barracks purchase is an explicit consistency/identity operation, waits for the server UID, and applies the same tier-aware replacement refund as the builder.

Accepted limitation: FlashLingo's wider coin economy is intentionally client-authoritative and offline-compatible. The barracks operation does not claim to make that wallet tamper-proof; doing so would require moving all earning and spending to a server transaction/receipt model outside this change.

Verification reviewed: 31 farm-server tests, 35 builder tests, 11 API tests, the deployed 12,036-test full suite, 286 source/live feature checks, and `git diff --check` all passed.
