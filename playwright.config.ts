import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests against `next dev` and a local, freshly seeded Supabase
 * stack (`supabase start && supabase db reset`). Admin tests also need
 * E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD for an owner account WITHOUT
 * two-factor (create it as in docs/first-admin.md).
 */
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: 'npm run dev', url: 'http://localhost:3000', reuseExistingServer: true, timeout: 120_000 },
});
