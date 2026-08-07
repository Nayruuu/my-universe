import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    maxWorkers: '75%',
    testTimeout: 10_000,
  },
});
