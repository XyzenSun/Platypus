import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 60000,
    include: ['tests/e2e/**/*.test.ts'],
    globalSetup: ['./tests/e2e/global-setup.ts'],
    fileParallelism: false,
  },
});
