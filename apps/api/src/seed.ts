import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { createDemoScene, demoModels, type ModelDefinition } from '@climbed/contracts';
import { databaseUrl, production } from './config.ts';
import { fingerprint, hashPassword } from './security.ts';

export const fixtures = {
  alpine: '11111111-1111-4111-8111-111111111111', other: '22222222-2222-4222-8222-222222222222',
  roomA: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', roomB: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', roomC: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
};
export async function seed(pool: Pool, models: ModelDefinition[] = demoModels) {
  if (production()) throw new Error('Les comptes de démonstration sont interdits en production.');
  const passwordHash = await hashPassword('climbed-local-demo');
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    await db.query("SELECT pg_advisory_xact_lock(7241002)");
    for (const [id, name] of [[fixtures.alpine, 'Alpine'], [fixtures.other, 'Autre client']])
      await db.query('INSERT INTO organizations(id,name) VALUES($1,$2) ON CONFLICT DO NOTHING', [id, name]);
    const accounts = [
      ['10000000-0000-4000-8000-000000000001', fixtures.alpine, 'alice@climbed.local', 'Alice', 'admin', [fixtures.roomA, fixtures.roomB]],
      ['10000000-0000-4000-8000-000000000002', fixtures.alpine, 'bob@climbed.local', 'Bob', 'setter', [fixtures.roomA]],
      ['20000000-0000-4000-8000-000000000001', fixtures.other, 'clara@climbed.local', 'Clara', 'admin', [fixtures.roomC]],
      ['10000000-0000-4000-8000-000000000003', fixtures.alpine, 'manager@climbed.local', 'Responsable', 'manager', [fixtures.roomA]],
    ] as const;
    for (const [id, org, email, name, role] of accounts)
      await db.query('INSERT INTO app_users(id,org_id,email,name,role,password_hash) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO NOTHING', [id, org, email, name, role, passwordHash]);
    for (const [room, org, name] of [[fixtures.roomA, fixtures.alpine, 'Alpine — Atelier'], [fixtures.roomB, fixtures.alpine, 'Alpine — Annexe'], [fixtures.roomC, fixtures.other, 'Autre client — Bloc']]) {
      const scene = { ...createDemoScene(), models: structuredClone(models) };
      const inserted = await db.query('INSERT INTO rooms(id,org_id,name,scene) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING id', [room, org, name, scene]);
      if (inserted.rowCount) {
        const actor = org === fixtures.alpine ? accounts[0][0] : accounts[2][0];
        await db.query('INSERT INTO scene_versions(id,org_id,room_id,revision,scene,actor_id) VALUES($1,$2,$3,1,$4,$5)', [randomUUID(), org, room, scene, actor]);
        for (const model of models) {
          const quantity = model.kind === 'volume' ? 1 : 12;
          for (let i = 0; i < quantity; i++)
            await db.query('INSERT INTO stock_items(id,org_id,room_id,model_id,model_fingerprint) VALUES($1,$2,$3,$4,$5)', [randomUUID(), org, room, model.id, fingerprint(model)]);
        }
      }
    }
    for (const [user, org, , , , rooms] of accounts)
      for (const room of rooms)
        await db.query('INSERT INTO room_access(org_id,room_id,user_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [org, room, user]);
    await db.query('COMMIT');
  } catch (error) { await db.query('ROLLBACK'); throw error; }
  finally { db.release(); }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pool = new Pool({ connectionString: databaseUrl() });
  try { await seed(pool); console.log('Jeu de démonstration local préparé (sans écraser les salles existantes).'); }
  catch { console.error('Échec du seed local ; vérifier les migrations et NODE_ENV.'); process.exitCode = 1; }
  finally { await pool.end(); }
}
