-- 024-ghost-offering-payouts.sql — one offering pays one child once a day.
--
-- GET /api/ghost-offering mints a fresh sessionId on every open, on purpose:
-- an allow_bot account replays the scene as a new QA round each time, keyed on
-- `${eventDate}#${sessionId}`. But allow_bot is also the Cướp Đêm gate — i.e.
-- every child who has the feature — and each replayed round was inserting real
-- coin_grants rows. Close the screen, reopen it, collect the same 14 offerings:
-- +530 xu, again, as often as you like.
--
-- The scene still replays; the PAYOUT is now gated on this ledger, which is
-- keyed by the real calendar day and never by a session.
--
-- Apply with:
--   npx wrangler@3 d1 execute eng_pwa_db --remote --file db/024-ghost-offering-payouts.sql

CREATE TABLE IF NOT EXISTS ghost_offering_payouts (
  user_id    INTEGER NOT NULL,
  event_date TEXT NOT NULL,
  item_id    TEXT NOT NULL,
  reward     INTEGER NOT NULL,
  claimed_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, event_date, item_id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Everything already paid before this table existed. Public (non-preview)
-- claims are keyed on the plain event date and are the ones worth carrying
-- over; preview rounds carry a '#session' suffix and are deliberately skipped,
-- so a child who legitimately has an offering waiting today still gets it once.
INSERT OR IGNORE INTO ghost_offering_payouts (user_id, event_date, item_id, reward, claimed_at)
  SELECT user_id, event_date, item_id, reward, claimed_at
    FROM ghost_offering_claims WHERE event_date NOT LIKE '%#%';
