import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import type { SceneDocument } from '@climbed/contracts';
import { databaseUrl } from '../src/config.ts';
import { migrate } from '../src/migrate.ts';
import { seed, fixtures } from '../src/seed.ts';
import { PostgresRepository, type AuthSession } from '../src/repository.ts';
import { testScene, wallPlacement } from './fixtures.ts';

const testUrl = process.env.TEST_DATABASE_URL;
describe.skipIf(!testUrl)('PostgreSQL : fixations autoritaires et compatibilité des salles existantes', () => {
  let pool: Pool, repository: PostgresRepository, alice: AuthSession;
  const save = async (scene: SceneDocument) => repository.save(alice, fixtures.roomA, scene, (await repository.room(alice, fixtures.roomA)).revision);
  beforeAll(async () => {
    if (!testUrl || !new URL(testUrl).pathname.endsWith('_test') || new URL(testUrl).pathname === new URL(databaseUrl()).pathname) throw new Error('Ces tests exigent une base dédiée distincte suffixée _test.');
    pool = new Pool({ connectionString: testUrl, max: 2 });
    repository = new PostgresRepository(pool);
    await migrate(pool);
  });
  beforeEach(async () => {
    await pool.query('TRUNCATE organizations,app_users,rooms,room_access,sessions,scene_versions,stock_items,reservations,occupations,idempotency,audit_events CASCADE');
    await seed(pool);
    alice = await repository.session((await repository.login('alice@climbed.local', 'climbed-local-demo')).token);
  });
  afterAll(async () => { await pool?.end(); });

  it('refuse une nouvelle prise hors insert sans version, stock ni audit partiels', async () => {
    const scene = testScene();
    scene.placements = [wallPlacement('aligned-bolt', 'hold-jug')];
    const prepared = await save(scene);
    const versions = await pool.query('SELECT count(*)::int AS n FROM scene_versions WHERE room_id=$1', [fixtures.roomA]);
    scene.placements[0]!.position = [0.125, 1.125, 0];
    await expect(save(scene)).rejects.toMatchObject({ status: 400 });
    const after = await repository.room(alice, fixtures.roomA);
    expect(after.scene).toEqual(prepared.scene);
    expect(after.revision).toBe(prepared.revision);
    expect(after.audit).toEqual(prepared.audit);
    expect(after.inventory).toEqual(prepared.inventory);
    expect((await pool.query('SELECT count(*)::int AS n FROM scene_versions WHERE room_id=$1', [fixtures.roomA])).rows).toEqual(versions.rows);
  });

  it('ouvre et sauvegarde une ancienne prise hors trame sans la déplacer, puis exige un insert pour la modifier', async () => {
    const legacy = testScene();
    legacy.placements = [{ ...wallPlacement('legacy-before-mounting', 'hold-jug'), position: [0.123456, 1.654321, 0] }];
    // This is a migration fixture, deliberately written as a room created by the previous POC.
    // Application writes below must still pass through the real repository validation.
    await pool.query('UPDATE rooms SET scene=$1 WHERE id=$2', [legacy, fixtures.roomA]);
    const loaded = await repository.room(alice, fixtures.roomA);
    expect(loaded.scene.placements[0]!.position).toEqual([0.123456, 1.654321, 0]);
    const renamed = structuredClone(loaded.scene);
    renamed.name = 'Ancienne salle conservée';
    await expect(save(renamed)).resolves.toMatchObject({ scene: renamed });
    const moved = structuredClone(renamed);
    moved.placements[0]!.position[0] += 0.01;
    await expect(save(moved)).rejects.toMatchObject({ status: 400 });
    moved.placements[0]!.position = [0.25, 1.75, 0];
    await expect(save(moved)).resolves.toMatchObject({ scene: moved });
  });

  it('sauvegarde plusieurs niveaux et leur escalier mais refuse un pan rattaché à un étage absent', async () => {
    const scene = testScene();
    scene.levels = [
      { id: 'level-ground', name: 'Niveau 0', elevation: 0, outline: [[-3, -1], [7, -1], [7, 6], [-3, 6]] },
      { id: 'level-mezzanine', name: 'Niveau 1', elevation: 3.5, outline: [[-3, -1], [7, -1], [7, 6], [-3, 6]] },
    ];
    scene.walls[0]!.levelId = 'level-ground';
    scene.walls[1]!.levelId = 'level-mezzanine';
    scene.walls[1]!.position[1] = 3.5;
    scene.stairs = [{ id: 'stairs-one', name: 'Escalier principal', fromLevelId: 'level-ground', toLevelId: 'level-mezzanine', start: [0, 0], end: [0, 3], width: 1.2, steps: 15 }];
    const prepared = await save(scene);
    expect((await repository.room(alice, fixtures.roomA)).scene).toEqual(scene);
    scene.walls[1]!.levelId = 'non-existent-floor';
    await expect(save(scene)).rejects.toMatchObject({ status: 400 });
    const after = await repository.room(alice, fixtures.roomA);
    expect(after.scene).toEqual(prepared.scene);
    expect(after.revision).toBe(prepared.revision);
  });
});
