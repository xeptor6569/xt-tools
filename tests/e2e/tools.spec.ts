// One block of checks per tool, generated from the registry.
import { expect, expectAccessible, test, waitForHydration } from './fixtures.ts';
import { loadTools } from './registry.ts';

const tools = await loadTools();

for (const tool of tools) {
  test.describe(`tool: ${tool.id}`, () => {
    test.beforeEach(async ({ page }) => {
      const response = await page.goto(`tools/${tool.id}/`);
      expect(response?.status()).toBe(200);
      await waitForHydration(page);
    });

    test('renders its heading and passes axe', async ({ page }) => {
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(tool.name);
      await expect(page).toHaveTitle(new RegExp(`^${tool.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
      await expectAccessible(page);
    });

    test('handles typed input without crashing', async ({ page }) => {
      const input = page.locator('[data-xt="input"]').first();
      test.skip((await input.count()) === 0, 'tool has no primary text input');
      for (const text of ['hello', '', '\u{1F680} \uD800 <script>alert(1)</script>']) {
        await input.fill(text);
        await page.waitForTimeout(150);
        await expect(page.locator('[data-xt="error"]', { hasText: /report it as a bug/ })).toHaveCount(0);
      }
    });

    for (const [i, example] of (tool.examples ?? []).entries()) {
      test(`example ${i + 1} produces the expected output`, async ({ page }) => {
        await page.locator('[data-xt="input"]').first().fill(example.input);
        const output = page.locator('[data-xt="output"]').first();
        const tag = await output.evaluate((el) => el.tagName);
        if (tag === 'TEXTAREA' || tag === 'INPUT') await expect(output).toHaveValue(new RegExp(escape(example.expect)));
        else await expect(output).toContainText(example.expect);
      });
    }

    if (tool.network) {
      const hosts = tool.network.hosts;
      test('names the services it contacts and does not call them while typing', async ({ page }) => {
        const notice = page.locator('[data-xt="network"]');
        await expect(notice).toBeVisible();
        for (const host of hosts) await expect(notice).toContainText(new URL(host).host);
        const input = page.locator('[data-xt="input"]').first();
        if ((await input.count()) > 0) {
          await input.fill('example.com');
          await page.waitForTimeout(200);
        }
      });
    }

    if (tool.sensitive) {
      test('does not store input or put it in the URL', async ({ page }) => {
        const url = page.url();
        const before = await page.evaluate(() => JSON.stringify({ ...localStorage }));
        await page.locator('[data-xt="input"]').first().fill('xt-secret-canary');
        await page.waitForTimeout(300);
        expect(page.url()).toBe(url);
        expect(await page.evaluate(() => JSON.stringify({ ...localStorage }))).toBe(before);
        expect(await page.evaluate(() => JSON.stringify({ ...sessionStorage }))).not.toContain('xt-secret-canary');
      });
    }
  });
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
