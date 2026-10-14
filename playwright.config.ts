import { defineConfig, devices } from '@playwright/test';

// E2E_BASE_URL points at a running site (the container in CI). Without it,
// tests run against `astro preview` of the current dist/ (built with the same
// BASE_PATH). The dev server is never used: CSP is off in dev mode.
const basePath = process.env.BASE_PATH ?? '/';
const external = process.env.E2E_BASE_URL;
const baseURL = external ? (external.endsWith('/') ? external : `${external}/`) : `http://localhost:4321${basePath}`;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  ...(external
    ? {}
    : {
        webServer: {
          command: 'npx astro preview --port 4321 --ignore-lock',
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          env: { ASTRO_TELEMETRY_DISABLED: '1' },
        },
      }),
});
