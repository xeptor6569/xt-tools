// Behaviour of shared UI-kit pieces, exercised through real tool pages.
import type { Page } from '@playwright/test';
import { expect, test, waitForHydration } from './fixtures.ts';

/**
 * Reads what the page last copied. Over plain HTTP (e.g. the e2e container
 * network) there is no Clipboard API and the copy button falls back to
 * execCommand('copy'), so record that path through the copy event too.
 */
async function trackCopies(page: Page) {
  await page.addInitScript(() => {
    document.addEventListener('copy', (e) => {
      const el = e.target as HTMLTextAreaElement | null;
      (window as unknown as { __xtCopied?: string }).__xtCopied = el?.value ?? '';
    });
  });
}

async function lastCopied(page: Page): Promise<string> {
  return page.evaluate(async () =>
    window.isSecureContext && navigator.clipboard
      ? navigator.clipboard.readText()
      : ((window as unknown as { __xtCopied?: string }).__xtCopied ?? ''),
  );
}

test.describe('persistence and sharing (json-format)', () => {
  test('nothing is stored until "Remember" is switched on', async ({ page }) => {
    await page.goto('tools/json-format/');
    await waitForHydration(page);
    await page.locator('[data-xt="input"]').fill('{"a":1}');
    expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);

    await page.getByRole('switch', { name: 'Remember on this device' }).check();
    await page.getByRole('switch', { name: 'Sort keys' }).check();
    await expect
      .poll(() => page.evaluate(() => Object.entries(localStorage).find(([k]) => k.endsWith('json-format:sort'))?.[1]))
      .toBe('true');
    await page.reload();
    await waitForHydration(page);
    await expect(page.locator('[data-xt="input"]')).toHaveValue('{"a":1}');
    await expect(page.getByRole('switch', { name: 'Sort keys' })).toBeChecked();

    await page.getByRole('switch', { name: 'Remember on this device' }).uncheck();
    expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.includes('json-format')))).toEqual([]);
  });

  test('a share link restores the input from the URL fragment', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await trackCopies(page);
    await page.goto('tools/json-format/');
    await waitForHydration(page);
    await page.locator('[data-xt="input"]').fill('{"shared":true}');
    await page.getByRole('button', { name: 'Copy share link' }).click();
    await expect(page.getByText('Link copied.')).toBeVisible();
    const link = await lastCopied(page);
    expect(new URL(link).hash).toMatch(/^#s=/);
    expect(new URL(link).search).toBe('');

    const other = await context.newPage();
    await other.goto(link);
    await waitForHydration(other);
    await expect(other.locator('[data-xt="input"]')).toHaveValue('{"shared":true}');
    await expect(other.locator('[data-xt="output"]')).toHaveValue(/"shared": true/);
  });
});

test('copy buttons put the output on the clipboard', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await trackCopies(page);
  await page.goto('tools/base-encoder/');
  await waitForHydration(page);
  await page.locator('[data-xt="input"]').fill('hi');
  await page.locator('[data-xt="copy"]').first().click();
  await expect(page.locator('[data-xt="copy"]').first()).toHaveText('Copied');
  expect(await lastCopied(page)).toBe('aGk=');
});

test('every control is reachable with Tab', async ({ page }) => {
  await page.goto('tools/uuid-generator/');
  await waitForHydration(page);
  const seen = new Set<string>();
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press('Tab');
    seen.add(
      await page.evaluate(
        () => document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.textContent?.trim() ?? '',
      ),
    );
  }
  expect([...seen]).toEqual(expect.arrayContaining(['Generate', 'Copy', 'Download']));
});

test('a runaway regex is stopped and the worker recovers', async ({ page }) => {
  await page.goto('tools/regex-tester/');
  await waitForHydration(page);
  await page.getByLabel('Test text').fill('a'.repeat(40) + '!');
  await page.locator('[data-xt="input"]').fill('(a+)+$');
  await expect(page.locator('[data-xt="error"]')).toHaveText(/Stopped after 2 seconds/, { timeout: 10_000 });
  await page.locator('[data-xt="input"]').fill('a{3}');
  await expect(page.locator('[data-xt="match-count"]')).toHaveText(/13 matches/);
  await expect(page.locator('[data-xt="error"]')).toHaveText('');
});

test('downloads are generated locally', async ({ page }) => {
  await page.goto('tools/qr-generator/');
  await waitForHydration(page);
  await expect(page.locator('[data-xt="qr"]')).toBeVisible();
  for (const name of ['Download SVG', 'Download PNG']) {
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^qr-code\.(svg|png)$/);
    expect(file.url()).toMatch(/^blob:/);
  }
});

test('large input is hashed in a worker without freezing the page', async ({ page }) => {
  await page.goto('tools/hash-text/');
  await waitForHydration(page);
  await page.locator('[data-xt="input"]').fill('x'.repeat(2_000_000));
  await expect(page.locator('[data-xt-value="SHA-256"]')).toHaveText(/^[0-9a-f]{64}$/, { timeout: 15_000 });
  // The main thread stays responsive while hashing.
  const start = Date.now();
  await page.evaluate(() => new Promise((r) => setTimeout(r, 0)));
  expect(Date.now() - start).toBeLessThan(1000);
});

test('untrusted Markdown is sanitized and sandboxed in the preview', async ({ page }) => {
  await page.goto('tools/markdown-editor/');
  await waitForHydration(page);
  const evil = [
    '# Hello',
    '<script>window.parent.__xtPwned = true</script>',
    '<img src="x" onerror="window.parent.__xtPwned = true">',
    '[click](javascript:alert(1))',
    '![tracker](https://tracker.example/pixel.png)',
    '<iframe src="https://evil.example/"></iframe>',
    '<form action="https://evil.example/"><input name="q"></form>',
  ].join('\n\n');
  await page.locator('[data-xt="input"]').fill(evil);
  const preview = page.locator('[data-xt="preview"]');
  await expect(preview).toHaveAttribute('srcdoc', /<h1>Hello<\/h1>/);
  const doc = (await preview.getAttribute('srcdoc')) ?? '';
  for (const bad of ['<script', 'onerror', 'javascript:', 'tracker.example', '<iframe', '<form'])
    expect(doc).not.toContain(bad);
  expect(doc).toContain('external content blocked');
  await expect(preview).toHaveAttribute('sandbox', '');
  expect(await page.evaluate(() => (window as unknown as { __xtPwned?: boolean }).__xtPwned)).toBeUndefined();
});
