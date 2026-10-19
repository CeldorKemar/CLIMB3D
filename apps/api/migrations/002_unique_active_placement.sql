-- Old pieces can await physical return while their replacement is reserved/installed.
-- Item exclusivity remains guaranteed separately for every active occupation.
CREATE UNIQUE INDEX one_installed_occupation_per_placement
 ON occupations(org_id,room_id,placement_id) WHERE state='installed' AND closed_at IS NULL;
