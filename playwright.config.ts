import { defineConfig } from '@playwright/test';
import { getConfig } from './tests/utils/config';

const config = getConfig(process.env.TEST_ENV as any || 'test');

export default defineConfig({
  testDir: './tests',
  timeout: 120000,  // 2 minutes total timeout
  expect: {
    timeout: 30000  // 30 seconds timeout for expect operations
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'dot' : 'list',
  use: {
    baseURL: config.baseURL,
    actionTimeout: 45000,
    navigationTimeout: 45000,
    trace: 'on-first-retry',
    headless: !!process.env.CI,
    ignoreHTTPSErrors: true,
    bypassCSP: true
  },
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium'
      }
    }
  ]
});