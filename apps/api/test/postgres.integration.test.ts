import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import type { SceneDocument } from '@climbed/contracts';
import { databaseUrl } from '../src/config.ts';
import { migrate } from '../src/migrate.ts';
import { seed, fixtures } from '../src/seed.ts';
import { PostgresRepository, type AuthSession } from '../src/repository.ts';
import { randomUUID } from 'node:crypto';
import { boxScene, testScene, wallPlacement } from './fixtures.ts';
import { validateScene } from '@climbed/geometry';

const testUrl = process.env.TEST_DATABASE_URL;
const enabled = !!testUrl;
const suite = describe.skipIf(!enabled);
suite('PostgreSQL réel : isolation, stock atomique et états physiques', () => {
  let pool: Pool;
  let repository: PostgresRepository;
  let alice: AuthSession, bob: AuthSession, clara: AuthSession;
  const request = () => randomUUID();
  const oneVolume = boxScene;
  const save = async (scene: SceneDocument) => {
    expect(validateScene(scene)).toEqual([]);
    const old = await repository.room(alice, fixtures.roomA);
    return repository.save(alice, fixtures.roomA, scene, old.revision);
  };
  const reserve = async () => {
    const old = await repository.room(alice, fixtures.roomA);
    const result = await repository.reserve(alice, fixtures.roomA, old.revision, request());
    return result.reservations[0]!.id;
  };
  const action = (id: string, action: 'withdraw' | 'install' | 'cancel' | 'request_return' | 'return') => repository.action(alice, fixtures.roomA, id, action, request());

  beforeAll(async () => {
    if (!testUrl || !new URL(testUrl).pathname.endsWith('_test') || new URL(testUrl).pathname === new URL(databaseUrl()).pathname) throw new Error('Intégration refusée : TEST_DATABASE_URL doit cibler une base distincte suffixée _test.');
    pool = new Pool({ connectionString: testUrl, max: 6 });
    repository = new PostgresRepository(pool);
    await migrate(pool);
  });
  beforeEach(async () => {
    // Only the explicitly guarded, dedicated test database is reset.
    await pool.query('TRUNCATE organizations,app_users,rooms,room_access,sessions,scene_versions,stock_items,reservations,occupations,idempotency,audit_events CASCADE');
    await seed(pool);
    alice = await repository.session((await repository.login('alice@climbed.local', 'climbed-local-demo')).token);
    bob = await repository.session((await repository.login('bob@climbed.local', 'climbed-local-demo')).token);
    clara = await repository.session((await repository.login('clara@climbed.local', 'climbed-local-demo')).token);
  });
  afterAll(async () => { await pool?.end(); });

  it('authentifie réellement et masque les salles hors périmètre', async () => {
    await expect(repository.login('alice@climbed.local', 'incorrect')).rejects.toMatchObject({ status: 401 });
    await expect(repository.room(clara, fixtures.roomA)).rejects.toMatchObject({ status: 404 });
    await expect(repository.room(bob, fixtures.roomB)).rejects.toMatchObject({ status: 404 });
    expect((await repository.bootstrap(bob)).rooms.map(r => r.id)).toEqual([fixtures.roomA]);
  });

  it('réserve une dernière pièce une seule fois sous concurrence', async () => {
    const saved = await save(oneVolume());
    const results = await Promise.allSettled([
      repository.reserve(alice, fixtures.roomA, saved.revision, request()),
      repository.reserve(alice, fixtures.roomA, saved.revision, request()),
    ]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(r => r.status === 'rejected')).toHaveLength(1);
    const count = await pool.query('SELECT count(*)::int AS n FROM occupations WHERE closed_at IS NULL');
    expect(count.rows[0].n).toBe(1);
  });

  it('permet deux interventions parallèles sur des pans distincts et du stock distinct', async () => {
    const scene = oneVolume();
    scene.placements.push({ ...scene.placements[0]!, id: 'side-target', modelId: 'volume-prism', parentId: scene.walls[1]!.id });
    const saved = await save(scene);
    const results = await Promise.all([
      repository.reserve(alice, fixtures.roomA, saved.revision, request(), [scene.walls[0]!.id]),
      repository.reserve(bob, fixtures.roomA, saved.revision, request(), [scene.walls[1]!.id]),
    ]);
    expect(results).toHaveLength(2);
    const state = await repository.room(alice, fixtures.roomA);
    expect(state.reservations.filter(r => r.state === 'reserved')).toHaveLength(2);
    expect(state.inventory.find(i => i.modelId === 'volume-box')!.reserved).toBe(1);
    expect(state.inventory.find(i => i.modelId === 'volume-prism')!.reserved).toBe(1);
    expect(state.reservations.every(r => r.wallIds?.length === 1)).toBe(true);
  });

  it('oppose une pénurie réelle entre pans disjoints visant la même dernière pièce', async () => {
    const scene = oneVolume();
    scene.placements.push({ ...scene.placements[0]!, id: 'side-target', parentId: scene.walls[1]!.id });
    const saved = await save(scene);
    const results = await Promise.allSettled([
      repository.reserve(alice, fixtures.roomA, saved.revision, request(), [scene.walls[0]!.id]),
      repository.reserve(bob, fixtures.roomA, saved.revision, request(), [scene.walls[1]!.id]),
    ]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find(r => r.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason.message).toContain('Stock compatible insuffisant');
    expect((await pool.query('SELECT count(*)::int AS n FROM occupations WHERE closed_at IS NULL')).rows[0].n).toBe(1);
  });

  it('ne retire pas le matériel installé sur un pan hors périmètre', async () => {
    const scene = oneVolume();
    scene.placements.push({ ...scene.placements[0]!, id: 'side-target', modelId: 'volume-prism', parentId: scene.walls[1]!.id });
    await save(scene);
    const id = await reserve(); await action(id, 'withdraw'); await action(id, 'install');
    scene.placements = scene.placements.filter(p => p.parentId !== scene.walls[1]!.id);
    const saved = await save(scene);
    const result = await repository.reserve(alice, fixtures.roomA, saved.revision, request(), [scene.walls[0]!.id]);
    expect(result.inventory.find(i => i.modelId === 'volume-prism')!.installed).toBe(1);
    expect(result.reservations[0]!.removedCount).toBe(0);
  });

  it('rejette la pénurie sans réservation ni audit partiels', async () => {
    const scene = oneVolume();
    scene.placements.push({ ...scene.placements[0]!, id: 'second-target', position: [1, 1, 0] });
    const saved = await save(scene);
    await expect(repository.reserve(alice, fixtures.roomA, saved.revision, request())).rejects.toMatchObject({ status: 409 });
    expect((await pool.query('SELECT count(*)::int AS n FROM occupations')).rows[0].n).toBe(0);
    expect((await pool.query('SELECT count(*)::int AS n FROM reservations')).rows[0].n).toBe(0);
    expect((await repository.room(alice, fixtures.roomA)).audit.filter(e => e.action === 'reservation.created')).toHaveLength(0);
  });

  it('rejoue une clé avec une ancienne révision et refuse un autre contenu', async () => {
    const saved = await save(oneVolume());
    const key = request();
    const first = await repository.reserve(alice, fixtures.roomA, saved.revision, key);
    await save(oneVolume());
    const replay = await repository.reserve(alice, fixtures.roomA, saved.revision, key);
    expect(replay).toEqual(first);
    await expect(repository.reserve(alice, fixtures.roomA, saved.revision + 1, key)).rejects.toMatchObject({ status: 409 });
    expect((await pool.query('SELECT count(*)::int AS n FROM occupations')).rows[0].n).toBe(1);
  });

  it('distingue annulation avant et après retrait et exige le retour physique', async () => {
    await save(oneVolume());
    let id = await reserve();
    let state = await action(id, 'cancel');
    expect(state.inventory.find(i => i.modelId === 'volume-box')!.available).toBe(1);
    id = await reserve();
    await action(id, 'withdraw');
    state = await action(id, 'cancel');
    expect(state.reservations.find(r => r.id === id)!.state).toBe('return_pending');
    expect(state.inventory.find(i => i.modelId === 'volume-box')!.available).toBe(0);
    state = await action(id, 'return');
    expect(state.inventory.find(i => i.modelId === 'volume-box')!.available).toBe(1);
    expect(state.reservations.find(r => r.id === id)!.state).toBe('cancelled');
  });

  it('conserve une pièce installée lors des changements puis checkout sans libération anticipée', async () => {
    await save(oneVolume());
    let id = await reserve();
    await action(id, 'withdraw');
    await action(id, 'install');
    const scene = oneVolume(); scene.placements[0]!.position = [0.2, 1.2, 0];
    await save(scene);
    id = await reserve();
    let state = await repository.room(alice, fixtures.roomA);
    const operation = state.reservations.find(r => r.id === id)!;
    expect(operation.addedCount).toBe(0); expect(operation.retainedCount).toBe(1);
    await action(id, 'install');
    expect((await pool.query('SELECT count(*)::int AS n FROM occupations WHERE closed_at IS NULL')).rows[0].n).toBe(1);
    state = await action(id, 'request_return');
    expect(state.inventory.find(i => i.modelId === 'volume-box')!.available).toBe(0);
    state = await action(id, 'return');
    expect(state.inventory.find(i => i.modelId === 'volume-box')!.available).toBe(1);
  });

  it('refuse de compter une même pièce déjà occupée sur un autre placement', async () => {
    await save(oneVolume());
    const id = await reserve(); await action(id, 'withdraw'); await action(id, 'install');
    const scene = oneVolume(); scene.placements[0]!.id = 'another-placement';
    const saved = await save(scene);
    await expect(repository.reserve(alice, fixtures.roomA, saved.revision, request())).rejects.toMatchObject({ status: 409 });
    const state = await repository.room(alice, fixtures.roomA);
    expect(state.inventory.find(i => i.modelId === 'volume-box')!.installed).toBe(1);
  });

  it('traite les retraits comme delta et ne réalloue pas les conservés', async () => {
    const scene = oneVolume();
    const hold = wallPlacement('delta-hold', 'hold-jug'); hold.position = [1, 2, 0];
    scene.placements.push(hold);
    await save(scene);
    let id = await reserve(); await action(id, 'withdraw'); await action(id, 'install');
    await save(oneVolume());
    id = await reserve();
    let state = await action(id, 'install');
    expect(state.inventory.find(i => i.modelId === 'hold-jug')!.returnPending).toBe(1);
    expect(state.inventory.find(i => i.modelId === 'volume-box')!.installed).toBe(1);
    state = await action(id, 'return');
    expect(state.inventory.find(i => i.modelId === 'hold-jug')!.available).toBe(12);
    expect(state.inventory.find(i => i.modelId === 'volume-box')!.installed).toBe(1);
  });

  it('ne compte pas deux fois une prise commune à plusieurs blocs', async () => {
    const scene = testScene();
    scene.placements = Array.from({ length: 5 }, (_, index) => ({ ...wallPlacement(`shared-hold-${index}`, 'hold-jug'), position: [-1 + index * 0.4, 2, 0] as [number, number, number] }));
    const ids = scene.placements.map(p => p.id);
    scene.boulders = [
      { id: 'shared-first', name: 'Bloc A', grade: '5c', color: '#f07c54', placementIds: ids, startIds: [ids[0]!], finishIds: [ids[4]!] },
      { id: 'shared-second', name: 'Bloc B', grade: '6a', color: '#f07c54', placementIds: ids, startIds: [ids[0]!], finishIds: [ids[4]!] },
    ];
    const saved = await save(scene);
    const state = await repository.reserve(alice, fixtures.roomA, saved.revision, request());
    expect(state.inventory.find(i => i.modelId === 'hold-jug')!.reserved).toBe(5);
  });

  it('démonte simultanément un volume et sa prise enfant sans perdre leur stock ou leur ancien support', async () => {
    const scene = oneVolume();
    scene.placements.push({ ...wallPlacement('child-on-box', 'hold-jug'), parentType: 'volume', parentId: 'physical-target', position: [0, 0, 0.25] });
    expect(validateScene(scene)).toEqual([]);
    await save(scene);
    let id = await reserve(); await action(id, 'withdraw'); await action(id, 'install');
    const initial = await pool.query('SELECT placement_id,wall_id,actual_placement FROM occupations WHERE closed_at IS NULL ORDER BY placement_id');
    expect(initial.rows).toHaveLength(2);
    expect(initial.rows.every(row => row.wall_id === 'wall-main')).toBe(true);
    expect(initial.rows.find(row => row.placement_id === 'child-on-box')!.actual_placement.placement.parentId).toBe('physical-target');
    const empty = testScene(); expect(validateScene(empty)).toEqual([]);
    await save(empty);
    id = await reserve();
    let state = await action(id, 'install');
    expect(state.reservations.find(r => r.id === id)!.removedCount).toBe(2);
    expect(state.inventory.find(i => i.modelId === 'volume-box')!.returnPending).toBe(1);
    expect(state.inventory.find(i => i.modelId === 'hold-jug')!.returnPending).toBe(1);
    const removed = await pool.query('SELECT actual_placement,removed_at FROM occupations WHERE closed_at IS NULL');
    expect(removed.rows.every(row => row.removed_at instanceof Date)).toBe(true);
    expect(removed.rows.find(row => row.actual_placement.placement.id === 'child-on-box')!.actual_placement.placement.parentId).toBe('physical-target');
    state = await action(id, 'return');
    expect(state.inventory.find(i => i.modelId === 'volume-box')!.available).toBe(1);
    expect(state.inventory.find(i => i.modelId === 'hold-jug')!.available).toBe(12);
    expect((await pool.query('SELECT count(*)::int AS n FROM occupations WHERE closed_at IS NULL')).rows[0].n).toBe(0);
  });

  it('remplace un modèle au même placement sans libérer prématurément la pièce déposée', async () => {
    await save(oneVolume());
    let id = await reserve(); await action(id, 'withdraw'); await action(id, 'install');
    const scene = oneVolume(); scene.placements[0]!.modelId = 'volume-prism';
    await save(scene);
    id = await reserve();
    await action(id, 'withdraw');
    let state = await action(id, 'install');
    expect(state.inventory.find(i => i.modelId === 'volume-prism')!.installed).toBe(1);
    expect(state.inventory.find(i => i.modelId === 'volume-box')!.returnPending).toBe(1);
    expect(state.inventory.find(i => i.modelId === 'volume-box')!.available).toBe(0);
    const old = await pool.query("SELECT removed_at FROM occupations WHERE placement_id='physical-target' AND state='return_pending'");
    expect(old.rows[0].removed_at).toBeInstanceOf(Date);
    state = await action(id, 'return');
    expect(state.inventory.find(i => i.modelId === 'volume-box')!.available).toBe(1);
    expect(state.inventory.find(i => i.modelId === 'volume-prism')!.installed).toBe(1);
  });

  it('impose en SQL les clés tenant/salle et une seule occupation par pièce', async () => {
    await save(oneVolume()); const id = await reserve();
    const row = (await pool.query('SELECT * FROM occupations WHERE reservation_id=$1', [id])).rows[0];
    await expect(pool.query("INSERT INTO occupations(id,org_id,room_id,item_id,placement_id,state,reservation_id,target_placement,wall_id) VALUES($1,$2,$3,$4,'duplicate','reserved',$5,'{}',$6)", [randomUUID(), row.org_id, row.room_id, row.item_id, id, row.wall_id])).rejects.toMatchObject({ code: '23505' });
    await expect(pool.query('INSERT INTO room_access(org_id,room_id,user_id) VALUES($1,$2,$3)', [fixtures.other, fixtures.roomA, clara.user.id])).rejects.toMatchObject({ code: '23503' });
  });
});
