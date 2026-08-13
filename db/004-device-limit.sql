-- 004-device-limit.sql — cap how many accounts one device may create.
--
-- The hole: a child (or anyone) could register a throwaway account, befriend
-- it and farm cups. The 3-day friendship delay already removes the instant
-- payoff; this removes the supply of throwaway accounts.
--
-- device_id is a RANDOM OPAQUE STRING the client generates once and keeps in
-- localStorage. It is deliberately NOT a fingerprint and NOT an IP address:
--   * fingerprinting a children's app is not acceptable, and
--   * an IP limit would block siblings and classmates sharing one home or
--     school network — the exact people this app is built for.
-- Clearing browser storage therefore resets it. That is a known and accepted
-- limit: this stops the casual "let me just make another profile", and the
-- 3-day friendship gate is what stops the determined case.
--
-- Existing users keep device_id NULL. NULL never matches an equality test, so
-- nobody already registered is retroactively counted against a device.
--
-- Apply BEFORE deploying the client that sends deviceId:
--   npx wrangler@3 d1 execute eng_pwa_db --remote --file db/004-device-limit.sql

ALTER TABLE users ADD COLUMN device_id TEXT;

-- The registration path counts rows for one device on every signup, so this
-- index is what keeps that a lookup rather than a table scan.
CREATE INDEX IF NOT EXISTS idx_users_device ON users(device_id);
