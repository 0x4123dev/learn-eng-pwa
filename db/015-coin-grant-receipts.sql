-- 015-coin-grant-receipts.sql — grants survive a crash between claim and save.
--
-- POST /api/coins used to stamp a grant claimed BEFORE the child's device had
-- durably saved the coins. If the app died (or the profile guard bailed) in
-- that instant, the gift was gone: no retry, no receipt, no record.
--
-- Now a claim is two-phase:
--   claim: claimed_at + a fresh receipt  -> the row is PENDING
--   ack:   confirmed_at (client sends the receipt after localStorage save)
-- A pending row with no ack after 10 minutes is offered again on the next
-- sync. Legacy clients (no proto flag) keep the old claim-equals-confirm
-- semantics — their rows are confirmed on the spot and never re-offered, so
-- an out-of-date app can never be double-paid.
--
-- Apply BEFORE deploying the code that reads it:
--   npx wrangler@3 d1 execute eng_pwa_db --remote --file db/015-coin-grant-receipts.sql

ALTER TABLE coin_grants ADD COLUMN receipt TEXT;
ALTER TABLE coin_grants ADD COLUMN confirmed_at TEXT;

-- Every grant claimed under the old protocol was final the moment it was
-- claimed; record that, or the new re-offer rule would pay them all again.
UPDATE coin_grants SET confirmed_at = claimed_at
  WHERE claimed_at IS NOT NULL AND confirmed_at IS NULL;
