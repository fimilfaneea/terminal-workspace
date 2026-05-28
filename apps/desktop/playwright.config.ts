import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  timeout: 30_000,
  workers: 1,
  fullyParallel: false,
  reporter: 'list',
  use: {
    headless: false,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
