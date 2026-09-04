-- 025-coin-grant-device.sql — a pending grant is only re-offered to the device
-- that claimed it.
--
-- db/015 made a claim two-phase so a crash between "server stamped it" and
-- "device saved it" could not lose the gift: an un-acked row is offered again
-- after ten minutes. That window was not scoped to a device, so the SECOND
-- phone on the same account was handed the same grant — it has none of the
-- first phone's pendingCoinReceipts, so it never acked either, and its
-- re-claim overwrote `receipt`, which made the first phone's ack match nothing.
--
-- That was a double-credit. It is now also a double-DEBIT risk: Cướp Đêm
-- settles the sleeping defender through coin_grants, so an amount can be
-- negative and being paid twice means being robbed twice.
--
-- Apply with:
--   npx wrangler@3 d1 execute eng_pwa_db --remote --file db/025-coin-grant-device.sql

ALTER TABLE coin_grants ADD COLUMN claimed_device TEXT;
