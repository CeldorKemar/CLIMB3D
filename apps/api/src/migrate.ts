import { Pool } from 'pg';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { databaseUrl } from './config.ts';
import { digest } from './security.ts';

export async function migrate(pool: Pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(7241001)");
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, sha256 text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
    const directory = fileURLToPath(new URL('../migrations/', import.meta.url));
    for (const name of (await readdir(directory)).filter(n => n.endsWith('.sql')).sort()) {
      const sql = await readFile(`${directory}/${name}`, 'utf8');
      const previous = await client.query('SELECT sha256 FROM schema_migrations WHERE name=$1', [name]);
      if (previous.rowCount) {
        if (previous.rows[0].sha256 !== digest(sql)) throw new Error(`Migration modifiée après application : ${name}`);
      } else {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations(name,sha256) VALUES($1,$2)', [name, digest(sql)]);
      }
    }
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pool = new Pool({ connectionString: databaseUrl() });
  try { await migrate(pool); console.log('Migrations PostgreSQL appliquées.'); }
  catch { console.error('Échec des migrations PostgreSQL ; vérifier configuration et accès.'); process.exitCode = 1; }
  finally { await pool.end(); }
}
