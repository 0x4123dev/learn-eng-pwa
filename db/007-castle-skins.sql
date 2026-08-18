-- Cosmetic-only castle skin selected by each player when the battle begins.
-- No HP, armour or collision value is stored because every skin fights alike.
ALTER TABLE battles ADD COLUMN challenger_castle_skin TEXT NOT NULL DEFAULT 'stone-keep';
ALTER TABLE battles ADD COLUMN opponent_castle_skin   TEXT NOT NULL DEFAULT 'stone-keep';
