-- Hired đồng đội: each side's squad, and the charges spent on each turn.
--
-- The squad is snapshotted ON THE BATTLE, not read from the user's live
-- profile: a hire is paid for one battle, and a replay months later must show
-- the bench that actually fought — not whoever the child has hired since.
--
-- Apply with: npx wrangler@3 d1 execute eng_pwa_db --remote --file db/006-battle-teammates.sql
ALTER TABLE battles ADD COLUMN challenger_hires TEXT NOT NULL DEFAULT '[]';
ALTER TABLE battles ADD COLUMN opponent_hires   TEXT NOT NULL DEFAULT '[]';

-- Abilities ride on the turn that spent them, so both phones replay one action
-- stream and can never disagree about which HP a repair landed on.
ALTER TABLE battle_turns ADD COLUMN abilities TEXT NOT NULL DEFAULT '[]';
ALTER TABLE battle_turns ADD COLUMN rocket    INTEGER NOT NULL DEFAULT 0;
