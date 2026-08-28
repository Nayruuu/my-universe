import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // V8 coverage plus the high-detail galaxy templates saturates the shared GitHub runner when
    // several isolated files build their first template together. Serialize CI files while keeping
    // local feedback parallel.
    maxWorkers: process.env['CI'] === 'true' ? 1 : '75%',
    // The first instrumented construction of the high-detail procedural galaxy is legitimate CPU
    // work on slower CI runners; subsequent constructions reuse immutable templates.
    testTimeout: 30_000,
  },
});
