DROP INDEX one_open_change_per_room;
ALTER TABLE reservations ADD COLUMN wall_ids text[] NOT NULL DEFAULT '{}';
UPDATE reservations r SET wall_ids=ARRAY(SELECT w->>'id' FROM jsonb_array_elements(r.target_scene->'walls') AS w);
ALTER TABLE reservations ADD CONSTRAINT reservation_walls_nonempty CHECK(cardinality(wall_ids)>0);
ALTER TABLE occupations ADD COLUMN wall_id text;
UPDATE occupations o SET wall_id=CASE
 WHEN o.target_placement->'placement'->>'parentType'='wall' THEN o.target_placement->'placement'->>'parentId'
 ELSE (SELECT p->>'parentId' FROM jsonb_array_elements(r.target_scene->'placements') p
       WHERE p->>'id'=o.target_placement->'placement'->>'parentId' AND p->>'parentType'='wall' LIMIT 1)
 END FROM reservations r WHERE r.id=o.reservation_id AND r.org_id=o.org_id AND r.room_id=o.room_id;
ALTER TABLE occupations ALTER COLUMN wall_id SET NOT NULL;
ALTER TABLE occupations ADD CONSTRAINT occupation_wall_nonempty CHECK(length(wall_id)>0);
CREATE INDEX reservation_wall_scope ON reservations USING gin(wall_ids);
