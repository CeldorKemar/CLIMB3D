CREATE TABLE organizations (id uuid PRIMARY KEY, name text NOT NULL);
CREATE TABLE app_users (
 id uuid PRIMARY KEY, org_id uuid NOT NULL REFERENCES organizations(id), email text UNIQUE NOT NULL,
 name text NOT NULL, role text NOT NULL CHECK(role IN ('superadmin','admin','manager','setter')),
 password_hash text NOT NULL, UNIQUE(org_id,id)
);
CREATE TABLE rooms (
 id uuid PRIMARY KEY, org_id uuid NOT NULL REFERENCES organizations(id), name text NOT NULL,
 scene jsonb NOT NULL, revision integer NOT NULL DEFAULT 1 CHECK(revision > 0), UNIQUE(org_id,id)
);
CREATE TABLE room_access (
 org_id uuid NOT NULL, room_id uuid NOT NULL, user_id uuid NOT NULL,
 PRIMARY KEY(org_id,room_id,user_id), FOREIGN KEY(org_id,room_id) REFERENCES rooms(org_id,id),
 FOREIGN KEY(org_id,user_id) REFERENCES app_users(org_id,id)
);
CREATE TABLE sessions (
 token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES app_users(id), csrf_token text NOT NULL,
 expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_expiry ON sessions(expires_at);
CREATE TABLE scene_versions (
 id uuid PRIMARY KEY, org_id uuid NOT NULL, room_id uuid NOT NULL, revision integer NOT NULL,
 scene jsonb NOT NULL, actor_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(org_id,room_id) REFERENCES rooms(org_id,id), FOREIGN KEY(org_id,actor_id) REFERENCES app_users(org_id,id),
 UNIQUE(org_id,room_id,revision)
);
CREATE TABLE stock_items (
 id uuid PRIMARY KEY, org_id uuid NOT NULL, room_id uuid NOT NULL, model_id text NOT NULL,
 model_fingerprint text NOT NULL, physical_state text NOT NULL DEFAULT 'in_storage'
 CHECK(physical_state IN ('in_storage','taken','on_wall','return_due')),
 FOREIGN KEY(org_id,room_id) REFERENCES rooms(org_id,id), UNIQUE(org_id,room_id,id)
);
CREATE INDEX stock_room_model ON stock_items(org_id,room_id,model_id);
CREATE TABLE reservations (
 id uuid PRIMARY KEY, org_id uuid NOT NULL, room_id uuid NOT NULL, actor_id uuid NOT NULL,
 state text NOT NULL CHECK(state IN ('reserved','taken','installed','return_pending','returned','cancelled')),
 scene_revision integer NOT NULL, target_scene jsonb NOT NULL,
 added_ids uuid[] NOT NULL DEFAULT '{}', retained_ids uuid[] NOT NULL DEFAULT '{}', removed_ids uuid[] NOT NULL DEFAULT '{}',
 return_ids uuid[] NOT NULL DEFAULT '{}', completion_state text NOT NULL DEFAULT 'installed'
 CHECK(completion_state IN ('installed','cancelled','returned')),
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(org_id,room_id) REFERENCES rooms(org_id,id), FOREIGN KEY(org_id,actor_id) REFERENCES app_users(org_id,id),
 UNIQUE(org_id,room_id,id)
);
CREATE UNIQUE INDEX one_open_change_per_room ON reservations(org_id,room_id)
 WHERE state IN ('reserved','taken','return_pending');
CREATE TABLE occupations (
 id uuid PRIMARY KEY, org_id uuid NOT NULL, room_id uuid NOT NULL, item_id uuid NOT NULL,
 placement_id text NOT NULL, state text NOT NULL CHECK(state IN ('reserved','taken','installed','return_pending','released')),
 reservation_id uuid NOT NULL, actual_placement jsonb, target_placement jsonb NOT NULL,
 withdrawn_at timestamptz, installed_at timestamptz, removed_at timestamptz, closed_at timestamptz,
 FOREIGN KEY(org_id,room_id,item_id) REFERENCES stock_items(org_id,room_id,id),
 FOREIGN KEY(org_id,room_id,reservation_id) REFERENCES reservations(org_id,room_id,id),
 CHECK((state = 'released') = (closed_at IS NOT NULL))
);
CREATE UNIQUE INDEX one_active_occupation_per_item ON occupations(org_id,item_id) WHERE closed_at IS NULL;
CREATE INDEX occupations_room ON occupations(org_id,room_id) WHERE closed_at IS NULL;
CREATE TABLE idempotency (
 org_id uuid NOT NULL, room_id uuid NOT NULL, actor_id uuid NOT NULL, operation text NOT NULL,
 request_id text NOT NULL, payload_hash text NOT NULL, response jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(org_id,room_id,actor_id,operation,request_id),
 FOREIGN KEY(org_id,room_id) REFERENCES rooms(org_id,id), FOREIGN KEY(org_id,actor_id) REFERENCES app_users(org_id,id)
);
CREATE TABLE audit_events (
 id uuid PRIMARY KEY, org_id uuid NOT NULL, room_id uuid NOT NULL, actor_id uuid NOT NULL,
 action text NOT NULL, detail text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(org_id,room_id) REFERENCES rooms(org_id,id), FOREIGN KEY(org_id,actor_id) REFERENCES app_users(org_id,id)
);
