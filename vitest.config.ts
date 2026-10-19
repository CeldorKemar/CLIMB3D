import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/**/*.{test,spec}.ts', 'apps/api/**/*.{test,spec}.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', 'tests/e2e/**'],
    pool: 'forks',
    maxWorkers: 1,
    minWorkers: 1,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
