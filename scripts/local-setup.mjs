import { copyFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
if (process.env.NODE_ENV === 'production') throw new Error('setup:local utilise exclusivement des données fictives de développement.');
if (!existsSync('.env')) {
  copyFileSync('.env.example', '.env');
  console.log('Configuration locale créée.');
}
process.loadEnvFile('.env');
const compose = ['compose', '--env-file', '.env', '-f', 'infra/compose.yaml'];
function run(command, args, capture = false) {
  const result = spawnSync(command, args, { cwd: root, stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit', encoding: 'utf8' });
  if (result.error) throw new Error(`Impossible de lancer ${command} : ${result.error.message}`);
  if (result.status !== 0) process.exit(result.status ?? 1);
  return result.stdout?.trim() ?? '';
}
run('docker', [...compose, 'up', '-d', '--wait']);
const testExists = run('docker', [...compose, 'exec', '-T', 'postgres', 'psql', '-U', 'climbed', '-d', 'postgres', '-tAc', "SELECT 1 FROM pg_database WHERE datname='climbed_test'"], true);
if (testExists !== '1') run('docker', [...compose, 'exec', '-T', 'postgres', 'createdb', '-U', 'climbed', 'climbed_test']);
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('Lancer cette préparation avec npm run setup:local.');
run(process.execPath, [npmCli, 'run', 'db:migrate']);
run(process.execPath, [npmCli, 'run', 'db:seed']);
console.log('Préparation locale terminée. Démarrer l’atelier avec npm run dev.');
