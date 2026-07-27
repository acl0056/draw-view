import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Discover co-located and dedicated test files across the workspace
    // packages. packages/core is the first package wired in here; new
    // packages are picked up automatically as they add *.test.js files.
    include: ['packages/**/*.{test,spec}.js'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    environment: 'node',
  },
});
