-- Apps now have their own tab and slice, apart from links and groups, so an
-- app no longer sits inside a group.
UPDATE shortcuts SET parent_id = NULL WHERE type = 'app';
