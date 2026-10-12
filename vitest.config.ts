import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    globals: true,
    root: './',
    include: ['test/unit/**/*.spec.ts', 'src/**/*.spec.ts'],
    exclude: ['test/e2e/**', 'node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/main.ts',
        'src/app.module.ts',
        'src/cluster.ts',
        'src/observe.ts',
        'src/config/prisma-sync.ts',
        'src/**/index.ts',
        'src/**/*.model.ts',
        'src/dto/**',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
});
