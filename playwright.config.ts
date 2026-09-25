import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  // why: 'line' alone leaves nothing to upload as a CI artifact (#3228669753);
  // the html report is written even when nobody looks at the line output live.
  reporter: process.env.CI
    ? [['line'], ['html', { outputFolder: 'playwright-report', open: 'never' }]]
    : 'html',
  use: {
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'editor',
      testDir: './apps/editor/tests',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.E2E_BASE_URL || 'http://localhost:3001',
      },
    },
    {
      name: 'website',
      testDir: './apps/website/tests',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
      },
    },
  ],
  // Note: For CI, use start-server-and-test in package.json scripts instead
  // This webServer config is for local development only
  webServer: process.env.CI
    ? undefined
    : [
        {
          command: 'pnpm dev:editor',
          url: 'http://localhost:3001',
          reuseExistingServer: true,
          timeout: 120 * 1000,
        },
        {
          command: 'pnpm dev:website',
          url: 'http://localhost:3000',
          reuseExistingServer: true,
          timeout: 120 * 1000,
        },
      ],
});

