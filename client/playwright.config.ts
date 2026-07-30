import { defineConfig, devices } from '@playwright/test';

const localChrome = process.env['CI'] ? {} : { channel: 'chrome' as const };

export default defineConfig({
  testDir: './e2e',
  outputDir: 'test-results',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env['CI']),
  retries: process.env['CI'] ? 2 : 0,
  timeout: 60_000,
  expect: {
    timeout: 8_000,
  },
  reporter: [['line'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4300',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
    ...localChrome,
  },
  projects: [
    {
      name: 'desktop-chromium',
      testIgnore: '**/*.mobile.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1_440, height: 900 },
        ...localChrome,
      },
    },
    {
      name: 'mobile-chromium',
      testMatch: '**/*.mobile.spec.ts',
      use: {
        ...devices['Pixel 7'],
        ...localChrome,
      },
    },
  ],
  webServer: {
    command: 'npm start -- --host 127.0.0.1 --port 4300',
    url: 'http://127.0.0.1:4300',
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
    env: {
      NG_CLI_ANALYTICS: 'false',
    },
  },
});
