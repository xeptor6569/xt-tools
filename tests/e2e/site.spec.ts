import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { categories } from '../../src/categories.ts';
import { expect, expectAccessible, serviceWorkerAvailable, test, waitForHydration } from './fixtures.ts';
import { loadTools } from './registry.ts';

const tools = await loadTools();
const cspFile = join(import.meta.dirname, '..', '..', 'build', 'server', 'csp.txt');

test('home page lists every tool', async ({ page }) => {
  await page.goto('');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tools');
  for (const tool of tools) {
    await expect(page.getByRole('link', { name: new RegExp(tool.name) }).first()).toBeVisible();
  }
  await expectAccessible(page);
});

test('category pages list their tools', async ({ page }) => {
  for (const category of categories) {
    const response = await page.goto(`category/${category.id}/`);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(category.label);
    for (const tool of tools.filter((t) => t.category === category.id)) {
      await expect(page.getByRole('link', { name: new RegExp(tool.name) }).first()).toBeVisible();
    }
  }
});

test('search index contains every tool', async ({ request }) => {
  const response = await request.get('search-index.json');
  expect(response.ok()).toBe(true);
  const index = (await response.json()) as Array<{ id: string; tags: string[] }>;
  expect(index.map((t) => t.id).sort()).toEqual(tools.map((t) => t.id).sort());
  expect(index.every((tool) => tool.tags.length > 0)).toBe(true);
});

test('search matches a title, a description, a tag and a keyword', async ({ page }) => {
  await page.goto('');
  const search = page.getByRole('combobox', { name: 'Search tools' });
  await expect(page.locator('[data-xt="search"]')).toHaveAttribute('data-xt-search', 'ready');
  const list = page.getByRole('listbox', { name: 'Search results' });

  await page.keyboard.press('/');
  await expect(search).toBeFocused();
  await search.fill('slugify');
  await expect(list.getByRole('option').first()).toContainText('Slugify');

  await search.fill('permalink');
  await expect(list.getByRole('option', { name: /Slugify/ })).toBeVisible();

  await search.fill('url-friendly');
  await expect(list.getByRole('option', { name: /Slugify/ })).toBeVisible();

  await page.keyboard.press('Control+k');
  await expect(search).toBeFocused();
  await search.fill('slugify');
  await expect(list.getByRole('option').first()).toContainText('Slugify');
  await search.press('Enter');
  await expect(page).toHaveURL(/\/tools\/slugify\/$/);

  await expect(page.locator('[data-xt="search"]')).toHaveAttribute('data-xt-search', 'ready');
  await page.getByRole('button', { name: 'Search tools tagged url' }).click();
  await expect(page.getByRole('combobox', { name: 'Search tools' })).toHaveValue('url');
  await expect(
    page.getByRole('listbox', { name: 'Search results' }).getByRole('option', { name: /Slugify/ }),
  ).toBeVisible();
  await expectAccessible(page);
});

test('unknown pages return the custom 404', async ({ page, guard }) => {
  guard.allowNotFound();
  const response = await page.goto('this-page-does-not-exist/');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Page not found');
  await expectAccessible(page);
});

test('theme choice applies immediately and survives a reload', async ({ page }) => {
  await page.goto('');
  const select = page.locator('select[data-xt-theme]');
  await expect(select).toHaveValue('system');
  await select.selectOption('dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('select[data-xt-theme]')).toHaveValue('dark');
  await expectAccessible(page);
  await page.locator('select[data-xt-theme]').selectOption('system');
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.*/);
});

test('text category shows its curated groups', async ({ page }) => {
  await page.goto('category/text/');
  await expect(page.getByRole('heading', { level: 2, name: 'Transform' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Analyze' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Text cleanup' }).first()).toBeVisible();
  await expectAccessible(page);
});

test('pins stay on this device and lead the home page', async ({ page }) => {
  await page.goto('');
  await expect(page.locator('html')).toHaveAttribute('data-xt-pins', 'ready');
  await page.locator('[data-xt="tool-grid"] button[data-xt-pin="tool:slugify"]').click();
  const pinned = page.locator('[data-xt="pinned"]');
  await expect(pinned.getByRole('link', { name: 'Slugify' })).toBeVisible();
  await page.locator('button[data-xt-pin="category:text"]').click();
  await expect(pinned.getByRole('link', { name: /^Category Text/ })).toBeVisible();
  await page.locator('button[data-xt-pin="group:text/transform"]').click();
  await expect(pinned.getByRole('link', { name: /^Text Transform/ })).toBeVisible();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-xt-pins', 'ready');
  await expect(page.locator('[data-xt="pinned"]').getByRole('link', { name: 'Slugify' })).toBeVisible();
  await expect(page.locator('[data-xt="pinned"]').getByRole('link', { name: /^Category Text/ })).toBeVisible();
  await expect(page.locator('[data-xt="pinned"]').getByRole('link', { name: /^Text Transform/ })).toBeVisible();
  await page.locator('[data-xt="pinned"] button[data-xt-pin="tool:slugify"]').click();
  await expect(page.locator('[data-xt="pinned"]').getByRole('link', { name: 'Slugify' })).toHaveCount(0);
  await expectAccessible(page);
});

test('personal collections and sub-collections stay on this device', async ({ page }) => {
  await page.goto('collections/#add-slugify');
  await waitForHydration(page);
  await expect(page.getByRole('button', { name: 'Create collection' })).toBeVisible();
  await page.getByLabel('New collection').fill('Daily');
  await page.getByRole('button', { name: 'Create collection' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Daily' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Slugify' })).toBeVisible();
  await page.getByLabel('New sub-collection in Daily').fill('Encoders');
  await page.getByRole('button', { name: 'Add sub-collection' }).click();
  await expect(page.getByRole('heading', { level: 3, name: 'Encoders' })).toBeVisible();
  await expectAccessible(page);
  await page.getByRole('button', { name: 'Pin the Daily collection' }).click();
  await page.goto('');
  await expect(page.locator('html')).toHaveAttribute('data-xt-pins', 'ready');
  await expect(page.locator('[data-xt="pinned"]').getByRole('link', { name: 'Daily' })).toBeVisible();
  await expect(page.locator('[data-xt="collection-list"]').getByRole('link', { name: /Daily/ })).toBeVisible();
  await page.reload();
  await expect(page.locator('[data-xt="collection-list"]').getByRole('link', { name: /Daily/ })).toBeVisible();
});

test('licenses page passes axe', async ({ page }) => {
  await page.goto('licenses/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Licenses');
  await expectAccessible(page);
});

test('settings page offers offline download and passes axe', async ({ page }) => {
  await page.goto('settings/');
  test.skip(!(await serviceWorkerAvailable(page)), 'plain HTTP other than localhost cannot register a service worker');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Settings');
  await expect(page.getByRole('button', { name: 'Download everything', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Clear all local data' })).toBeVisible();
  await expect(page.locator('[data-xt="offline-banner"]')).toBeHidden();
  await expect(page.locator('[data-xt="update"]')).toBeHidden();
  await expectAccessible(page);
});

test('settings page explains that offline mode needs HTTPS', async ({ page }) => {
  await page.goto('settings/');
  test.skip(await serviceWorkerAvailable(page), 'this origin can register a service worker');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Settings');
  await expect(page.locator('[data-xt="offline-banner"]')).toHaveText('Offline mode needs HTTPS.');
  await expect(page.locator('[data-xt="offline-needs-https"]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download everything', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Clear all local data' })).toBeVisible();
  await expect(page.locator('[data-xt="update"]')).toBeHidden();
  await expectAccessible(page);
});

test('clear all local data removes pins and the theme', async ({ page }) => {
  await page.goto('');
  await expect(page.locator('html')).toHaveAttribute('data-xt-pins', 'ready');
  await page.locator('[data-xt="tool-grid"] button[data-xt-pin="tool:slugify"]').click();
  await expect(page.locator('[data-xt="pinned"]').getByRole('link', { name: 'Slugify' })).toBeVisible();
  await page.goto('settings/');
  await page.locator('select[data-xt-theme]').first().selectOption('dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Clear all local data' }).click();
  const reloaded = page.waitForEvent('load');
  await page.getByRole('button', { name: 'Delete data' }).click();
  await reloaded;
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
  await page.goto('');
  await expect(page.locator('html')).toHaveAttribute('data-xt-pins', 'ready');
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.*/);
  await expect(page.locator('[data-xt="pinned"]').getByRole('link')).toHaveCount(0);
});

test('CSP meta tag is present on every page type', async ({ page }) => {
  for (const path of [
    '',
    'licenses/',
    'settings/',
    `category/${categories[0].id}/`,
    ...tools.slice(0, 3).map((t) => `tools/${t.id}/`),
  ]) {
    await page.goto(path);
    const csp = await page.locator('meta[http-equiv="content-security-policy"]').getAttribute('content');
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("default-src 'self'");
  }
});

// Only meaningful against the nginx container (astro preview sends no headers).
test('security headers match the generated policy', async ({ request }) => {
  test.skip(process.env.E2E_EXPECT_HEADERS !== '1', 'set E2E_EXPECT_HEADERS=1 when testing the container');
  const response = await request.get('');
  const headers = response.headers();
  const header = headers['content-security-policy'] ?? '';
  expect(header).toContain("frame-ancestors 'self'");
  if (existsSync(cspFile)) expect(header).toBe(readFileSync(cspFile, 'utf8').trim());
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['referrer-policy']).toBe('no-referrer');
  expect(headers['x-frame-options']).toBe('SAMEORIGIN');
  expect(headers['cross-origin-opener-policy']).toBe('same-origin');
  expect(headers['permissions-policy']).toContain('geolocation=()');
  expect(headers['server'] ?? '').not.toMatch(/\d/);
});
