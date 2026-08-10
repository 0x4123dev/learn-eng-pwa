-- Snapshot the challenger's arena choice for deterministic friend battles.
-- Apply with: npx wrangler@3 d1 execute eng_pwa_db --remote --file db/003-battle-backgrounds.sql
ALTER TABLE battles ADD COLUMN background_id TEXT NOT NULL DEFAULT 'cloudstep-meadow';
