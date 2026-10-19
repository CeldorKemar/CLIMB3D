CREATE TABLE design_snapshots (
 id uuid PRIMARY KEY, org_id uuid NOT NULL, room_id uuid NOT NULL, actor_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('room','boulder')), label text NOT NULL CHECK(length(label) BETWEEN 1 AND 120),
 boulder_id text, source_revision integer NOT NULL CHECK(source_revision>0), scene jsonb NOT NULL,
 content_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(org_id,room_id) REFERENCES rooms(org_id,id), FOREIGN KEY(org_id,actor_id) REFERENCES app_users(org_id,id),
 CHECK((kind='room' AND boulder_id IS NULL) OR (kind='boulder' AND boulder_id IS NOT NULL)),
 UNIQUE(org_id,room_id,id)
);
CREATE INDEX design_snapshots_room_date ON design_snapshots(org_id,room_id,created_at DESC);
INSERT INTO design_snapshots(id,org_id,room_id,actor_id,kind,label,source_revision,scene,content_hash,created_at)
 SELECT id,org_id,room_id,actor_id,'room','Sauvegarde v'||revision,revision,scene,
 encode(sha256(convert_to(scene::text,'UTF8')),'hex'),created_at FROM scene_versions;
CREATE FUNCTION prevent_design_snapshot_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Design snapshots are immutable' USING ERRCODE='23000'; END;
$$;
CREATE TRIGGER immutable_design_snapshots BEFORE UPDATE OR DELETE ON design_snapshots
 FOR EACH ROW EXECUTE FUNCTION prevent_design_snapshot_mutation();
ALTER TABLE stock_items ADD COLUMN retired_at timestamptz;
