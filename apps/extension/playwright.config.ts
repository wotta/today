import { defineConfig } from '@playwright/test';

// E2E tests load the built extension from .output/chrome-mv3 and drive the
// real new-tab UI in Chromium. The vitest unit suite lives under tests/ and is
// deliberately excluded here (testDir is ./e2e).
export default defineConfig({
  testDir: './e2e',
  // Each test launches its own persistent browser context (with its own
  // extension + IndexedDB), so keep it serial to avoid profile contention.
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 7_000 },
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    trace: 'on-first-retry',
  },
});
