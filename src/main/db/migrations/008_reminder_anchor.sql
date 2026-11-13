-- The time the person picked. Repeats count from it, so a 02:30 reminder
-- that rang at 03:30 on the spring clock change goes back to 02:30.
ALTER TABLE notes ADD COLUMN remind_anchor TEXT;
UPDATE notes SET remind_anchor = remind_at WHERE remind_at IS NOT NULL;
