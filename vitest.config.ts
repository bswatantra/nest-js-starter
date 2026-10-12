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
  },
});
