import { Pool } from 'pg';
import { demoModels } from '@climbed/contracts';
import { databaseUrl, production } from '../apps/api/src/config.ts';
import { migrate } from '../apps/api/src/migrate.ts';
import { fingerprint } from '../apps/api/src/security.ts';
import { seedTestFixtures } from '../apps/api/test/fixtures.ts';
import { directScrewModels } from '../packages/geometry/tests/fixtures.ts';

if (production()) throw new Error('Préparation E2E interdite en production.');
const development = new URL(databaseUrl());
const target = new URL(process.env.E2E_DATABASE_URL ?? development.toString());
if (!process.env.E2E_DATABASE_URL) target.pathname = '/climbed_fixings_e2e_test';
const name = target.pathname.slice(1);
if (!/^[a-z][a-z0-9_]*_e2e_test$/.test(name) || name === development.pathname.slice(1)) {
  throw new Error('Une base de fixtures distincte, suffixée _e2e_test, est obligatoire.');
}
const adminUrl = new URL(target); adminUrl.pathname = '/postgres';
const admin = new Pool({connectionString: adminUrl.toString()});
try {
  if (!(await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [name])).rowCount) {
    await admin.query(`CREATE DATABASE "${name}"`);
  }
} finally { await admin.end(); }
const pool = new Pool({connectionString: target.toString()});
try {
  await migrate(pool);
  const count = await pool.query('SELECT count(*)::int AS n FROM rooms');
  if (count.rows[0].n === 0) {
    await seedTestFixtures(pool);
    const rooms = await pool.query('SELECT id,scene FROM rooms');
    for (const {id, scene} of rooms.rows) {
      scene.placements = [];
      for (const route of scene.boulders) { route.placementIds = []; route.startIds = []; route.finishIds = []; }
      await pool.query('UPDATE rooms SET scene=$1 WHERE id=$2', [scene, id]);
    }
  }
  const rooms = await pool.query('SELECT id,scene FROM rooms');
  const expected = directScrewModels(demoModels);
  if (rooms.rows.length !== 3 || rooms.rows.some(({scene}) => scene.placements.length || expected.some(model =>
    !scene.models.some((candidate: typeof model) => candidate.id === model.id && fingerprint(candidate) === fingerprint(model))))) {
    throw new Error('Fixtures existantes différentes ou placements présents : inspecter cette base ; aucune scène existante n’a été réinitialisée.');
  }
  const inventory = await pool.query('SELECT room_id,model_id,count(*)::int AS n FROM stock_items WHERE retired_at IS NULL GROUP BY room_id,model_id');
  const occupied = await pool.query('SELECT count(*)::int AS n FROM occupations WHERE closed_at IS NULL');
  if (occupied.rows[0].n || rooms.rows.some(({id}) => expected.some(model =>
    inventory.rows.find(row => row.room_id === id && row.model_id === model.id)?.n !== (model.kind === 'volume' ? 1 : 12)))) {
    throw new Error('Stock des fixtures différent ou occupations actives : terminer ou compenser le test concerné avant de reprendre.');
  }
  console.log(`Fixtures E2E prêtes dans ${name}. Les scènes de développement sont préservées.`);
} finally { await pool.end(); }
