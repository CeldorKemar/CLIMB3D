export function databaseUrl(): string {
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error('DATABASE_URL obligatoire. Configurer une base PostgreSQL avant de démarrer.');
  const url = new URL(value);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('DATABASE_URL doit désigner PostgreSQL.');
  return value;
}

export const SESSION_COOKIE = 'climbed_session';
export const production = () => process.env.NODE_ENV === 'production';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const localEnv = fileURLToPath(new URL('../../../.env', import.meta.url));
if (process.env.NODE_ENV !== 'production' && existsSync(localEnv)) process.loadEnvFile(localEnv);
