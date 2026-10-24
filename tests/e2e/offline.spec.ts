// Service workers are blocked in the main suite so every request stays visible.
// This spec allows them and checks the offline path from PLAN.md section 10.
// The container suite loads the site at http://site:8080, which is not a secure
// context, so that run checks the HTTPS banner instead of registering a worker.
import type { Page } from '@playwright/test';
import { expect, serviceWorkerAvailable, test, waitForHydration } from './fixtures.ts';

test.use({ serviceWorkers: 'allow' });

async function waitForPrecache(page: Page): Promise<void> {
  await page.waitForFunction(
    async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration?.active || !navigator.serviceWorker.controller) return false;
      const names = await caches.keys();
      for (const name of names) {
        const cache = await caches.open(name);
        if ((await cache.keys()).length > 20) return true;
      }
      return false;
    },
    undefined,
    { timeout: 60_000 },
  );
}

test('the manifest and service worker script are published', async ({ request, baseURL }) => {
  if (!baseURL) throw new Error('baseURL is not set');
  const manifestResponse = await request.get('manifest.webmanifest');
  expect(manifestResponse.ok()).toBeTruthy();
  const manifest = (await manifestResponse.json()) as { start_url: string; scope: string; icons: { src: string }[] };
  const scope = new URL(baseURL).pathname;
  expect(manifest.start_url).toBe(scope);
  expect(manifest.scope).toBe(scope);
  for (const icon of manifest.icons) {
    const iconResponse = await request.get(icon.src);
    expect(iconResponse.ok(), icon.src).toBeTruthy();
  }
  const worker = await request.get('sw.js');
  expect(worker.ok()).toBeTruthy();
  expect(await worker.text()).toContain('SKIP_WAITING');
});

test('plain HTTP shows that offline mode needs HTTPS', async ({ page }) => {
  await page.goto('');
  test.skip(await serviceWorkerAvailable(page), 'this origin can register a service worker');
  await expect(page.locator('[data-xt="offline-banner"]')).toHaveText('Offline mode needs HTTPS.');
  await expect(page.locator('[data-xt="update"]')).toBeHidden();
});

test('pages and a heavy tool work offline after download everything', async ({ page, baseURL }) => {
  test.setTimeout(120_000);
  if (!baseURL) throw new Error('baseURL is not set');

  await page.goto('');
  test.skip(!(await serviceWorkerAvailable(page)), 'plain HTTP other than localhost cannot register a service worker');
  await waitForPrecache(page);
  await expect(page.locator('[data-xt="offline-banner"]')).toBeHidden();
  await expect(page.locator('[data-xt="update"]')).toBeHidden();

  await page.goto('settings/');
  await page.getByRole('button', { name: 'Download everything', exact: true }).click();
  await expect(page.locator('[data-xt="download-status"]')).toContainText(/Saved \d+ files for offline use/, {
    timeout: 60_000,
  });

  await page.context().setOffline(true);

  await page.goto('tools/slugify/');
  await expect(page.getByRole('heading', { level: 1, name: 'Slugify' })).toBeVisible();
  await page.goto('tools/hash-text/');
  await expect(page.getByRole('heading', { level: 1, name: 'Hash text' })).toBeVisible();

  await page.goto('tools/sql-formatter/');
  await expect(page.getByRole('heading', { level: 1, name: 'SQL formatter' })).toBeVisible();
  await waitForHydration(page);
  await page.locator('[data-xt="input"]').fill('select id from users');
  await expect(page.locator('[data-xt="output"]')).toHaveValue(/SELECT/);
});
