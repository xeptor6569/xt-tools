import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { categories } from '../../src/categories.ts';
import { expect, expectAccessible, test } from './fixtures.ts';
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
      await expect(page.getByRole('link', { name: new RegExp(tool.name) })).toBeVisible();
    }
  }
});

test('search index contains every tool', async ({ request }) => {
  const response = await request.get('search-index.json');
  expect(response.ok()).toBe(true);
  const index = (await response.json()) as Array<{ id: string }>;
  expect(index.map((t) => t.id).sort()).toEqual(tools.map((t) => t.id).sort());
});

test('unknown pages return the custom 404', async ({ page, guard }) => {
  guard.allowNotFound();
  const response = await page.goto('this-page-does-not-exist/');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Page not found');
  await expectAccessible(page);
});

test('licenses page passes axe', async ({ page }) => {
  await page.goto('licenses/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Licenses');
  await expectAccessible(page);
});

test('CSP meta tag is present on every page type', async ({ page }) => {
  for (const path of [
    '',
    'licenses/',
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
