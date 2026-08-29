-- 017-coin-snapshot-peak.sql — separate "what the child has now" from
-- "what recovery would restore".
--
-- db/013 stored one number per learner per day. To stop a wiped device from
-- erasing the recovery value, that number was later MAX-ed on every sync —
-- which quietly turned the admin's Balance column into the day's HIGH-WATER
-- MARK. A child who earned 18,440 xu and then spent 8,000 on the pet shop was
-- reported as still holding 18,440.
--
-- Two questions, two columns:
--   balance      = the latest observation  → what the admin timeline shows
--   peak_balance = the highest that day    → what the wipe radar and a restore
--                                             grant are computed from
--
-- Apply BEFORE deploying the code that reads it:
--   npx wrangler@3 d1 execute eng_pwa_db --remote --file db/017-coin-snapshot-peak.sql

ALTER TABLE user_coin_snapshots ADD COLUMN peak_balance INTEGER;

-- Existing rows were already MAX-ed, so today's stored number IS the peak.
-- Seeding both keeps every historical day self-consistent.
UPDATE user_coin_snapshots SET peak_balance = balance WHERE peak_balance IS NULL;
