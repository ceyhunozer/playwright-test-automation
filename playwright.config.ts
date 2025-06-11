import { defineConfig } from '@playwright/test';
import { getConfig } from './tests/utils/config';

const config = getConfig(process.env.TEST_ENV as any || 'test');

export default defineConfig({
  testDir: './tests',  timeout: 180000,  // 3 minutes total timeout
  expect: {
    timeout: 45000  // 45 seconds timeout for expect operations
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'dot' : 'list',  use: {
    baseURL: config.baseURL,    actionTimeout: 60000,
    navigationTimeout: 60000,
    trace: 'on-first-retry',
    headless: !!process.env.CI,
    ignoreHTTPSErrors: true,
    bypassCSP: true,
    permissions: ['geolocation', 'notifications'],
    viewport: { width: 1280, height: 720 },
    screenshot: 'on',
    video: 'on-first-retry',
    contextOptions: {
      permissions: ['notifications'],
    }
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