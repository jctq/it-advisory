import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Loads `apps/web/.env.local` when `MONGODB_URI` is unset (local CLI runs).
 * Railway / `railway run` inject env vars — this is a no-op there.
 */
export function loadLocalEnvIfNeeded(): void {
  if (process.env.MONGODB_URI?.trim()) {
    return;
  }
  const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const envLocalPath = resolve(appRoot, '.env.local');
  if (!existsSync(envLocalPath) || typeof process.loadEnvFile !== 'function') {
    return;
  }
  process.loadEnvFile(envLocalPath);
}
