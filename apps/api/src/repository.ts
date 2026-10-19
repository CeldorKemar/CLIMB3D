import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Pool, type PoolClient } from 'pg';
import type { AuditEntry, BootstrapResponse, CreateSnapshotRequest, HistoryResponse, InventorySummary, ReservationAction, ReservationSummary, RoomState, SceneDocument, SessionUser, SnapshotSummary, StockOccupation } from '@climbed/contracts';
import { validateScene, validateSceneChange } from '@climbed/geometry';
import { fingerprint, token, digest, verifyPassword } from './security.ts';
import { computeDelta, InvalidPlan, placementWall, PlanningConflict, wallScope } from './domain/planning.ts';
import { mergeBoulderSnapshot } from './domain/restoration.ts';

export interface AuthSession { user: SessionUser; csrfToken: string; tokenHash: string }
export interface ClimbedRepository {
  health(): Promise<{ status: 'ok' }>;
  login(email: string, password: string): Promise<{ token: string; bootstrap: BootstrapResponse }>;
  session(rawToken: string): Promise<AuthSession>;
  bootstrap(session: AuthSession): Promise<BootstrapResponse>;
  logout(session: AuthSession): Promise<void>;
  room(session: AuthSession, roomId: string): Promise<RoomState>;
  save(session: AuthSession, roomId: string, scene: SceneDocument, expectedRevision: number): Promise<RoomState>;
  reserve(session: AuthSession, roomId: string, revision: number, requestId: string, wallIds?: string[]): Promise<RoomState>;
  action(session: AuthSession, roomId: string, reservationId: string, action: ReservationAction, requestId: string): Promise<RoomState>;
  history(session: AuthSession, roomId: string): Promise<HistoryResponse>;
  createSnapshot(session: AuthSession, roomId: string, input: CreateSnapshotRequest): Promise<SnapshotSummary>;
  restoreSnapshot(session: AuthSession, roomId: string, snapshotId: string, expectedRevision: number, requestId: string): Promise<RoomState>;
  setInventory(session: AuthSession, roomId: string, modelId: string, total: number, expectedRevision: number, requestId: string): Promise<RoomState>;
}
type Db = Pick<Pool, 'query'> | PoolClient;
type Occupation = {
  id: string; item_id: string; placement_id: string; state: string; reservation_id: string;
  model_fingerprint: string; wall_id: string; withdrawn_at: Date | null; target_placement: unknown; actual_placement: unknown;
};
type ReservationRow = {
  id: string; state: ReservationSummary['state']; added_ids: string[]; retained_ids: string[]; removed_ids: string[];
  return_ids: string[]; wall_ids: string[]; completion_state: string; target_scene: SceneDocument; actor_id: string;
};
export const REPOSITORY = Symbol('CLIMBED_REPOSITORY');
const conflict = (message: string) => new ConflictException({ message, code: 'CONFLICT' });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class PostgresRepository implements ClimbedRepository {
  constructor(readonly pool: Pool) {}
  async health(): Promise<{ status: 'ok' }> { await this.pool.query('SELECT 1'); return { status: 'ok' }; }
  async onApplicationShutdown() { await this.pool.end(); }

  async login(email: string, password: string) {
    const found = await this.pool.query('SELECT * FROM app_users WHERE email=$1', [email.toLowerCase()]);
    const row = found.rows[0];
    // A real scrypt calculation also covers unknown users, avoiding an easy timing distinction.
    const fallback = 'scrypt$00000000000000000000000000000000$' + '00'.repeat(64);
    const valid = await verifyPassword(password, row?.password_hash ?? fallback);
    if (!row || !valid) throw new UnauthorizedException('Identifiants incorrects.');
    const rawToken = token();
    const csrf = token();
    await this.pool.query("INSERT INTO sessions(token_hash,user_id,csrf_token,expires_at) VALUES($1,$2,$3,now()+interval '12 hours')", [digest(rawToken), row.id, csrf]);
    const session: AuthSession = { user: this.user(row), csrfToken: csrf, tokenHash: digest(rawToken) };
    return { token: rawToken, bootstrap: await this.bootstrap(session) };
  }

  private user(row: Record<string, any>): SessionUser {
    return { id: row.id, name: row.name, email: row.email, role: row.role, organizationId: row.org_id };
  }
  async session(rawToken: string): Promise<AuthSession> {
    if (!/^[a-f0-9]{64}$/.test(rawToken)) throw new UnauthorizedException('Session requise.');
    const result = await this.pool.query('SELECT u.*,s.csrf_token FROM sessions s JOIN app_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()', [digest(rawToken)]);
    if (!result.rowCount) throw new UnauthorizedException('Session expirée ou absente.');
    const row = result.rows[0];
    return { user: this.user(row), csrfToken: row.csrf_token, tokenHash: digest(rawToken) };
  }
  async bootstrap(session: AuthSession): Promise<BootstrapResponse> {
    const result = await this.pool.query('SELECT r.id,r.name,r.org_id AS "organizationId" FROM rooms r JOIN room_access a ON a.org_id=r.org_id AND a.room_id=r.id WHERE a.user_id=$1 AND r.org_id=$2 ORDER BY r.name', [session.user.id, session.user.organizationId]);
    return { user: session.user, csrfToken: session.csrfToken, rooms: result.rows };
  }
  async logout(session: AuthSession) { await this.pool.query('DELETE FROM sessions WHERE token_hash=$1', [session.tokenHash]); }

  private async authorize(db: Db, session: AuthSession, roomId: string, lock = false) {
    if (!uuid.test(roomId)) throw new NotFoundException('Salle introuvable.');
    const result = await db.query(`SELECT r.* FROM rooms r JOIN room_access a ON a.org_id=r.org_id AND a.room_id=r.id WHERE r.id=$1 AND r.org_id=$2 AND a.user_id=$3 ${lock ? 'FOR UPDATE OF r' : ''}`, [roomId, session.user.organizationId, session.user.id]);
    if (!result.rowCount) throw new NotFoundException('Salle introuvable.');
    return result.rows[0] as { id: string; org_id: string; scene: SceneDocument; revision: number };
  }

  async room(session: AuthSession, roomId: string) { await this.authorize(this.pool, session, roomId); return this.state(this.pool, session, roomId); }

  private async state(db: Db, session: AuthSession, roomId: string): Promise<RoomState> {
    const org = session.user.organizationId;
    const room = await db.query('SELECT scene,revision FROM rooms WHERE org_id=$1 AND id=$2', [org, roomId]);
    if (!room.rowCount) throw new NotFoundException('Salle introuvable.');
    const stock = await db.query(`SELECT s.model_id AS "modelId",count(*)::int AS total,
      count(*) FILTER(WHERE o.id IS NULL AND s.physical_state='in_storage')::int AS available,
      count(*) FILTER(WHERE o.state IN ('reserved','taken'))::int AS reserved,
      count(*) FILTER(WHERE o.state='installed')::int AS installed,
      count(*) FILTER(WHERE o.state='return_pending')::int AS "returnPending"
      FROM stock_items s LEFT JOIN occupations o ON o.org_id=s.org_id AND o.item_id=s.id AND o.closed_at IS NULL
      WHERE s.org_id=$1 AND s.room_id=$2 AND s.retired_at IS NULL GROUP BY s.model_id ORDER BY s.model_id`, [org, roomId]);
    const reservations = await db.query(`SELECT r.id,r.state,u.name AS "actorName",r.created_at AS "createdAt",r.scene_revision AS "sceneRevision",
      cardinality(r.added_ids)+cardinality(r.retained_ids) AS "pieceCount",cardinality(r.added_ids) AS "addedCount",
      cardinality(r.retained_ids) AS "retainedCount",cardinality(r.removed_ids) AS "removedCount"
      ,r.wall_ids AS "wallIds" FROM reservations r JOIN app_users u ON u.id=r.actor_id AND u.org_id=r.org_id
      WHERE r.org_id=$1 AND r.room_id=$2 ORDER BY r.created_at DESC LIMIT 50`, [org, roomId]);
    const audit = await db.query(`SELECT e.id,e.action,u.name AS "actorName",e.created_at AS "createdAt",e.detail
      FROM audit_events e JOIN app_users u ON u.id=e.actor_id AND u.org_id=e.org_id
      WHERE e.org_id=$1 AND e.room_id=$2 ORDER BY e.created_at DESC LIMIT 80`, [org, roomId]);
    const occupations = await db.query(`SELECT o.placement_id AS "placementId",o.state,o.reservation_id AS "reservationId",
      COALESCE(o.actual_placement->'model',o.target_placement->'model') AS model
      FROM occupations o WHERE o.org_id=$1 AND o.room_id=$2 AND o.closed_at IS NULL ORDER BY o.id`, [org, roomId]);
    const historicalModels = await db.query('SELECT DISTINCT model_id FROM stock_items WHERE org_id=$1 AND room_id=$2', [org, roomId]);
    return {
      scene: room.rows[0].scene, revision: room.rows[0].revision,
      inventory: stock.rows as InventorySummary[],
      reservations: reservations.rows.map(r => ({ ...r, createdAt: r.createdAt.toISOString() })) as ReservationSummary[],
      audit: audit.rows.map(r => ({ ...r, createdAt: r.createdAt.toISOString() })) as AuditEntry[],
      occupations: occupations.rows as StockOccupation[],
      lockedModelIds: [...new Set<string>([...historicalModels.rows.map(row => row.model_id as string), ...room.rows[0].scene.placements.map((p: { modelId: string }) => p.modelId)])],
    };
  }

  private async audit(db: Db, session: AuthSession, roomId: string, action: string, detail: string) {
    await db.query('INSERT INTO audit_events(id,org_id,room_id,actor_id,action,detail) VALUES($1,$2,$3,$4,$5,$6)', [randomUUID(), session.user.organizationId, roomId, session.user.id, action, detail]);
  }

  private async transaction<T>(run: (db: PoolClient) => Promise<T>): Promise<T> {
    const db = await this.pool.connect();
    try { await db.query('BEGIN'); const result = await run(db); await db.query('COMMIT'); return result; }
    catch (error) {
      await db.query('ROLLBACK');
      if (error instanceof InvalidPlan) throw new BadRequestException(error.message);
      if (error instanceof PlanningConflict) throw conflict(error.message);
      if (typeof error === 'object' && error !== null && 'code' in error && ['23505', '40001', '40P01'].includes(String(error.code))) throw conflict('Conflit concurrent : rechargez puis réessayez avec la même clé.');
      throw error;
    } finally { db.release(); }
  }

  async save(session: AuthSession, roomId: string, scene: SceneDocument, expectedRevision: number) {
    return this.transaction(async db => {
      const room = await this.authorize(db, session, roomId, true);
      if (room.revision !== expectedRevision) throw conflict('Le plan a changé. Rechargez avant de sauvegarder.');
      const issues = validateSceneChange(room.scene, scene);
      if (issues.length) throw new BadRequestException({ message: 'Géométrie ou références invalides.', details: issues });
      await this.assertCatalogVersions(db, room.org_id, roomId, scene, room.scene);
      const revision = await this.writeScene(db, session, roomId, scene, room.revision);
      await this.audit(db, session, roomId, 'scene.saved', `Plan sauvegardé, version ${revision}. Aucun stock consommé.`);
      return this.state(db, session, roomId);
    });
  }

  private async idempotent(session: AuthSession, roomId: string, operation: string, requestId: string, payload: unknown, run: (db: PoolClient, room: { scene: SceneDocument; revision: number }) => Promise<void>) {
    return this.idempotentResult(session, roomId, operation, requestId, payload, async (db, room) => {
      await run(db, room);
      return this.state(db, session, roomId);
    });
  }

  private async idempotentResult<T>(session: AuthSession, roomId: string, operation: string, requestId: string, payload: unknown, run: (db: PoolClient, room: { scene: SceneDocument; revision: number }) => Promise<T>): Promise<T> {
    return this.transaction(async db => {
      const room = await this.authorize(db, session, roomId, true);
      const scope = [session.user.organizationId, roomId, session.user.id, operation, requestId];
      const hash = fingerprint(payload);
      const old = await db.query('SELECT payload_hash,response FROM idempotency WHERE org_id=$1 AND room_id=$2 AND actor_id=$3 AND operation=$4 AND request_id=$5', scope);
      // Replay precedes revision checking: a successful old request stays safely replayable.
      if (old.rowCount) {
        if (old.rows[0].payload_hash !== hash) throw conflict('Clé de requête déjà utilisée avec un contenu différent.');
        return old.rows[0].response as T;
      }
      const response = await run(db, room);
      await db.query('INSERT INTO idempotency(org_id,room_id,actor_id,operation,request_id,payload_hash,response) VALUES($1,$2,$3,$4,$5,$6,$7)', [...scope, hash, response]);
      return response;
    });
  }

  private async lockStock(db: PoolClient, org: string, room: string) {
    await db.query('SELECT id FROM stock_items WHERE org_id=$1 AND room_id=$2 ORDER BY id FOR UPDATE', [org, room]);
    return (await db.query(`SELECT o.*,s.model_fingerprint FROM occupations o JOIN stock_items s ON s.org_id=o.org_id AND s.room_id=o.room_id AND s.id=o.item_id
      WHERE o.org_id=$1 AND o.room_id=$2 AND o.closed_at IS NULL ORDER BY o.id FOR UPDATE OF o`, [org, room])).rows as Occupation[];
  }

  private async writeScene(db: PoolClient, session: AuthSession, roomId: string, scene: SceneDocument, previousRevision: number) {
    const revision = previousRevision + 1, org = session.user.organizationId, versionId = randomUUID();
    await db.query('UPDATE rooms SET scene=$3,revision=$4 WHERE org_id=$1 AND id=$2 AND revision=$5', [org, roomId, scene, revision, previousRevision]);
    await db.query('INSERT INTO scene_versions(id,org_id,room_id,revision,scene,actor_id) VALUES($1,$2,$3,$4,$5,$6)', [versionId, org, roomId, revision, scene, session.user.id]);
    await db.query(`INSERT INTO design_snapshots(id,org_id,room_id,actor_id,kind,label,source_revision,scene,content_hash)
      VALUES($1,$2,$3,$4,'room',$5,$6,$7,encode(sha256(convert_to($7::jsonb::text,'UTF8')),'hex'))`, [versionId, org, roomId, session.user.id, `Sauvegarde v${revision}`, revision, scene]);
    return revision;
  }

  private async assertCatalogVersions(db: PoolClient, org: string, roomId: string, scene: SceneDocument, previous: SceneDocument) {
    const rows = await db.query('SELECT model_id,model_fingerprint,bool_or(retired_at IS NULL) AS active FROM stock_items WHERE org_id=$1 AND room_id=$2 GROUP BY model_id,model_fingerprint', [org, roomId]);
    if (rows.rows.some(row => row.active && !scene.models.some(model => model.id === row.model_id))) throw conflict('Un modèle possédant du stock actif ne peut pas être supprimé du catalogue.');
    for (const model of scene.models) {
      if (rows.rows.some(row => row.model_id === model.id && row.model_fingerprint !== fingerprint(model))) throw conflict('Un modèle inventorié est immuable : dupliquez-le sous un nouvel identifiant pour modifier sa géométrie.');
      const old = previous.models.find(m => m.id === model.id);
      if (old && previous.placements.some(p => p.modelId === model.id) && fingerprint(old) !== fingerprint(model)) throw conflict('Un modèle placé est immuable : dupliquez-le pour modifier sa définition.');
    }
  }

  private async availableStock(db: PoolClient, org: string, roomId: string) {
    return (await db.query(`SELECT s.* FROM stock_items s WHERE s.org_id=$1 AND s.room_id=$2 AND s.retired_at IS NULL AND s.physical_state='in_storage'
      AND NOT EXISTS(SELECT 1 FROM occupations o WHERE o.org_id=s.org_id AND o.item_id=s.id AND o.closed_at IS NULL) ORDER BY s.id`, [org, roomId])).rows;
  }

  async history(session: AuthSession, roomId: string): Promise<HistoryResponse> {
    await this.authorize(this.pool, session, roomId);
    const result = await this.pool.query(`SELECT s.id,s.kind,s.label,s.boulder_id AS "boulderId",s.source_revision AS "sourceRevision",s.created_at AS "createdAt",u.name AS "actorName"
      FROM design_snapshots s JOIN app_users u ON u.org_id=s.org_id AND u.id=s.actor_id
      WHERE s.org_id=$1 AND s.room_id=$2 ORDER BY s.created_at DESC,s.id DESC LIMIT 200`, [session.user.organizationId, roomId]);
    return { snapshots: result.rows.map(row => ({ ...row, boulderId: row.boulderId ?? undefined, createdAt: row.createdAt.toISOString() })) };
  }

  async createSnapshot(session: AuthSession, roomId: string, input: CreateSnapshotRequest): Promise<SnapshotSummary> {
    const { requestId, ...payload } = input;
    return this.idempotentResult(session, roomId, 'snapshot.create', requestId, payload, async (db, room) => {
      if (room.revision !== input.expectedRevision) throw conflict('Le plan a changé avant la sauvegarde.');
      if (input.kind === 'boulder' && !room.scene.boulders.some(b => b.id === input.boulderId)) throw new NotFoundException('Voie introuvable.');
      const id = randomUUID();
      const result = await db.query(`INSERT INTO design_snapshots(id,org_id,room_id,actor_id,kind,label,boulder_id,source_revision,scene,content_hash)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,encode(sha256(convert_to($9::jsonb::text,'UTF8')),'hex')) RETURNING created_at`, [id, session.user.organizationId, roomId, session.user.id, input.kind, input.label, input.boulderId ?? null, room.revision, room.scene]);
      await this.audit(db, session, roomId, 'snapshot.created', `Sauvegarde ${input.kind === 'room' ? 'de salle' : 'de voie'} « ${input.label} » à la révision ${room.revision}.`);
      return { id, kind: input.kind, label: input.label, boulderId: input.boulderId, sourceRevision: room.revision, createdAt: result.rows[0].created_at.toISOString(), actorName: session.user.name };
    });
  }

  async restoreSnapshot(session: AuthSession, roomId: string, snapshotId: string, expectedRevision: number, requestId: string) {
    if (!uuid.test(snapshotId)) throw new NotFoundException('Sauvegarde introuvable.');
    return this.idempotent(session, roomId, `snapshot.restore:${snapshotId}`, requestId, { expectedRevision }, async (db, room) => {
      if (room.revision !== expectedRevision) throw conflict('Le plan a changé avant la restauration.');
      const org = session.user.organizationId;
      const found = await db.query("SELECT *,encode(sha256(convert_to(scene::text,'UTF8')),'hex')=content_hash AS integrity_valid FROM design_snapshots WHERE org_id=$1 AND room_id=$2 AND id=$3", [org, roomId, snapshotId]);
      if (!found.rowCount) throw new NotFoundException('Sauvegarde introuvable.');
      const saved = found.rows[0];
      if (!saved.integrity_valid) throw conflict('Intégrité de la sauvegarde invalide.');
      const candidate = saved.kind === 'room' ? saved.scene as SceneDocument : mergeBoulderSnapshot(room.scene, saved.scene, saved.boulder_id, (a, b) => fingerprint(a) === fingerprint(b));
      // Restoring a scene is subject to the same mounting rules as a new edit.
      // Unchanged inherited anchors remain readable, but newly restored or
      // changed anchors must align with the declared receiving fixings.
      const issues = [...new Set([...validateScene(candidate), ...validateSceneChange(room.scene, candidate)])];
      if (issues.length) throw new ConflictException({ message: 'Restauration impossible : géométrie ou collisions invalides.', code: 'INVALID_RESTORE', details: issues });
      await this.assertCatalogVersions(db, org, roomId, candidate, room.scene);
      const occupied = await this.lockStock(db, org, roomId);
      const available = await this.availableStock(db, org, roomId);
      // A compatible piece already allocated to the same placement remains reusable.
      // This is a feasibility calculation only; no physical state, reservation or quantity changes.
      const reusable = occupied.map(o => ({ ...o, state: ['reserved', 'taken', 'installed'].includes(o.state) ? 'installed' : o.state }));
      computeDelta(candidate, reusable, available, wallScope(candidate, reusable, null), fingerprint);
      const revision = await this.writeScene(db, session, roomId, candidate, room.revision);
      await this.audit(db, session, roomId, 'snapshot.restored', `Sauvegarde « ${saved.label} » restaurée en version ${revision}. Aucun stock physique modifié.`);
    });
  }

  async setInventory(session: AuthSession, roomId: string, modelId: string, total: number, expectedRevision: number, requestId: string) {
    return this.idempotent(session, roomId, 'inventory.set', requestId, { modelId, total, expectedRevision }, async (db, room) => {
      if (!['admin', 'manager', 'superadmin'].includes(session.user.role)) throw new ForbiddenException('Seul un administrateur ou responsable peut déclarer le stock.');
      if (room.revision !== expectedRevision) throw conflict('Le plan a changé avant la déclaration de stock.');
      if (!Number.isInteger(total) || total < 0 || total > 10_000) throw new BadRequestException('Quantité de stock invalide.');
      const model = room.scene.models.find(m => m.id === modelId);
      if (!model) throw new NotFoundException('Modèle introuvable.');
      const org = session.user.organizationId, hash = fingerprint(model);
      await this.lockStock(db, org, roomId);
      const active = await db.query('SELECT id,model_fingerprint FROM stock_items WHERE org_id=$1 AND room_id=$2 AND model_id=$3 AND retired_at IS NULL ORDER BY id', [org, roomId, modelId]);
      if (active.rows.some(row => row.model_fingerprint !== hash)) throw conflict('Le stock existant appartient à une autre définition de ce modèle.');
      const delta = total - active.rows.length;
      if (delta > 0) {
        await db.query(`INSERT INTO stock_items(id,org_id,room_id,model_id,model_fingerprint)
          SELECT gen_random_uuid(),$1,$2,$3,$4 FROM generate_series(1,$5::int)`, [org, roomId, modelId, hash, delta]);
      } else if (delta < 0) {
        const free = (await this.availableStock(db, org, roomId)).filter(item => item.model_id === modelId);
        if (free.length < -delta) throw conflict('Des pièces sont réservées, installées ou dues au stock : réduction refusée.');
        await db.query('UPDATE stock_items SET retired_at=now() WHERE org_id=$1 AND room_id=$2 AND id=ANY($3::uuid[])', [org, roomId, free.slice(0, -delta).map(item => item.id)]);
      }
      await this.audit(db, session, roomId, 'inventory.declared', `Stock déclaré pour « ${model.name} » : ${total} exemplaire(s).`);
    });
  }

  async reserve(session: AuthSession, roomId: string, revision: number, requestId: string, requestedWallIds?: string[]) {
    const requested = requestedWallIds ? [...new Set(requestedWallIds)].sort() : null;
    return this.idempotent(session, roomId, 'reserve', requestId, { sceneRevision: revision, wallIds: requested }, async (db, room) => {
      if (room.revision !== revision) throw conflict('Version de plan obsolète.');
      const org = session.user.organizationId;
      const allOccupied = await this.lockStock(db, org, roomId);
      const wallIds = wallScope(room.scene, allOccupied, requested);
      const open = await db.query("SELECT id FROM reservations WHERE org_id=$1 AND room_id=$2 AND state IN ('reserved','taken','return_pending') AND wall_ids && $3::text[]", [org, roomId, wallIds]);
      if (open.rowCount) throw conflict('Une intervention est déjà ouverte sur un pan sélectionné.');
      const models = new Map(room.scene.models.map(m => [m.id, m]));
      const available = await this.availableStock(db, org, roomId);
      const { retained, add, removed } = computeDelta(room.scene, allOccupied, available, wallIds, fingerprint);
      const reservationId = randomUUID();
      await db.query('INSERT INTO reservations(id,org_id,room_id,actor_id,state,scene_revision,target_scene,retained_ids,removed_ids,wall_ids) VALUES($1,$2,$3,$4,\'reserved\',$5,$6,$7,$8,$9)', [reservationId, org, roomId, session.user.id, revision, room.scene, retained.map(o => o.id), removed.map(o => o.id), wallIds]);
      const addedIds: string[] = [];
      for (const { item, placement } of add) {
        const id = randomUUID(); addedIds.push(id);
        await db.query("INSERT INTO occupations(id,org_id,room_id,item_id,placement_id,state,reservation_id,target_placement,wall_id) VALUES($1,$2,$3,$4,$5,'reserved',$6,$7,$8)", [id, org, roomId, item.id, placement.id, reservationId, { placement, model: models.get(placement.modelId) }, placementWall(room.scene, placement.id)]);
      }
      await db.query('UPDATE reservations SET added_ids=$2 WHERE id=$1', [reservationId, addedIds]);
      // A removal request does not pretend that a physical piece has already returned.
      if (removed.length) await db.query("UPDATE occupations SET state='return_pending' WHERE org_id=$1 AND room_id=$2 AND id=ANY($3::uuid[])", [org, roomId, removed.map(o => o.id)]);
      await this.audit(db, session, roomId, 'reservation.created', `${add.length} ajout(s), ${retained.length} pièce(s) conservée(s), ${removed.length} retrait(s) à confirmer.`);
    });
  }

  async action(session: AuthSession, roomId: string, reservationId: string, action: ReservationAction, requestId: string) {
    if (!uuid.test(reservationId)) throw new NotFoundException('Réservation introuvable.');
    return this.idempotent(session, roomId, `action:${reservationId}`, requestId, { action }, async db => {
      const org = session.user.organizationId;
      const found = await db.query('SELECT * FROM reservations WHERE org_id=$1 AND room_id=$2 AND id=$3 FOR UPDATE', [org, roomId, reservationId]);
      if (!found.rowCount) throw new NotFoundException('Réservation introuvable.');
      const r = found.rows[0] as ReservationRow;
      const occupations = await this.lockStock(db, org, roomId);
      if (session.user.role === 'setter' && r.actor_id !== session.user.id) throw new ForbiddenException('Un ouvreur agit sur ses propres interventions.');
      const setPhase = async (ids: string[], phase: string) => {
        if (ids.length) await db.query('UPDATE occupations SET state=$4 WHERE org_id=$1 AND room_id=$2 AND id=ANY($3::uuid[]) AND closed_at IS NULL', [org, roomId, ids, phase]);
      };
      const setPhysical = async (ids: string[], state: string) => {
        if (ids.length) await db.query('UPDATE stock_items s SET physical_state=$4 FROM occupations o WHERE o.org_id=$1 AND o.room_id=$2 AND o.id=ANY($3::uuid[]) AND s.id=o.item_id AND s.org_id=o.org_id AND s.room_id=o.room_id', [org, roomId, ids, state]);
      };
      const release = async (ids: string[]) => {
        if (ids.length) {
          await setPhysical(ids, 'in_storage');
          await db.query("UPDATE occupations SET state='released',closed_at=now(),removed_at=CASE WHEN installed_at IS NOT NULL THEN COALESCE(removed_at,now()) ELSE removed_at END WHERE org_id=$1 AND room_id=$2 AND id=ANY($3::uuid[]) AND closed_at IS NULL", [org, roomId, ids]);
        }
      };
      let next: string;
      if (action === 'withdraw') {
        if (r.state !== 'reserved') throw conflict('Seule une réservation peut être retirée du stock.');
        await setPhase(r.added_ids, 'taken'); await setPhysical(r.added_ids, 'taken');
        await db.query('UPDATE occupations SET withdrawn_at=now() WHERE org_id=$1 AND room_id=$2 AND id=ANY($3::uuid[])', [org, roomId, r.added_ids]);
        next = 'taken';
      } else if (action === 'install') {
        if (r.state !== 'taken' && !(r.state === 'reserved' && r.added_ids.length === 0)) throw conflict('Confirmer le retrait physique avant installation.');
        // Confirming the new installation also confirms removal of its delta removals.
        // Their pieces stay unavailable until a separate physical return confirmation.
        await setPhysical(r.removed_ids, 'return_due');
        await db.query('UPDATE occupations SET removed_at=now() WHERE org_id=$1 AND room_id=$2 AND id=ANY($3::uuid[]) AND closed_at IS NULL', [org, roomId, r.removed_ids]);
        await setPhase(r.added_ids, 'installed'); await setPhysical(r.added_ids, 'on_wall');
        const targetIds = [...r.added_ids, ...r.retained_ids];
        for (const id of targetIds) {
          const occupation = occupations.find(o => o.id === id);
          if (!occupation) throw conflict('Occupation modifiée depuis la réservation.');
          const placement = r.target_scene.placements.find(p => p.id === occupation.placement_id)!;
          const snapshot = { placement, model: r.target_scene.models.find(m => m.id === placement.modelId) };
          await db.query('UPDATE occupations SET actual_placement=$4,target_placement=$4,installed_at=COALESCE(installed_at,now()),reservation_id=$5,wall_id=$6 WHERE org_id=$1 AND room_id=$2 AND id=$3', [org, roomId, id, snapshot, reservationId, placementWall(r.target_scene, placement.id)]);
        }
        next = r.removed_ids.length ? 'return_pending' : 'installed';
        await db.query("UPDATE reservations SET return_ids=$2,completion_state='installed' WHERE id=$1", [reservationId, r.removed_ids]);
      } else if (action === 'cancel') {
        if (!['reserved', 'taken'].includes(r.state)) throw conflict('Une installation confirmée nécessite un retour ; elle ne peut pas être annulée.');
        await setPhase(r.removed_ids, 'installed');
        if (r.state === 'reserved') { await release(r.added_ids); next = 'cancelled'; }
        else {
          await setPhase(r.added_ids, 'return_pending'); await setPhysical(r.added_ids, 'return_due');
          next = r.added_ids.length ? 'return_pending' : 'cancelled';
          await db.query("UPDATE reservations SET return_ids=$2,completion_state='cancelled' WHERE id=$1", [reservationId, r.added_ids]);
        }
      } else if (action === 'request_return') {
        if (r.state !== 'installed') throw conflict('Seule une installation confirmée peut demander son démontage.');
        const ids = [...r.added_ids, ...r.retained_ids];
        const current = occupations.filter(o => o.reservation_id === reservationId && ids.includes(o.id));
        if (current.length !== ids.length || !ids.length) throw conflict('Cette installation a été remplacée ; utiliser la dernière intervention.');
        const open = await db.query("SELECT id FROM reservations WHERE org_id=$1 AND room_id=$2 AND state IN ('reserved','taken','return_pending') AND wall_ids && $3::text[]", [org, roomId, r.wall_ids]);
        if (open.rowCount) throw conflict('Terminer l’intervention ouverte avant un checkout.');
        await setPhase(ids, 'return_pending');
        await db.query("UPDATE reservations SET return_ids=$2,completion_state='returned' WHERE id=$1", [reservationId, ids]);
        next = 'return_pending';
      } else if (action === 'return') {
        if (r.state !== 'return_pending') throw conflict('Aucun retour en attente.');
        // This explicit action confirms BOTH removal where needed and physical receipt at storage.
        await release(r.return_ids);
        next = r.completion_state;
      } else throw new BadRequestException('Action inconnue.');
      await db.query('UPDATE reservations SET state=$2 WHERE id=$1', [reservationId, next]);
      await this.audit(db, session, roomId, `reservation.${action}`, `Intervention ${reservationId.slice(0, 8)} : ${next}.`);
    });
  }
}
