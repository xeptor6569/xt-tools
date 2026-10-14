// Self-tests for the guard fixture: each of these must fail, proving that the
// checks every other test relies on actually catch problems.
import { test } from './fixtures.ts';

test.describe('guard self-test', () => {
  test('catches a request to another origin', async ({ page }) => {
    test.fail();
    await page.goto('');
    await page.evaluate(() => {
      const img = new Image();
      img.src = 'https://example.com/pixel.gif';
    });
    await page.waitForTimeout(300);
  });

  test('catches a CSP violation from an injected inline script', async ({ page }) => {
    test.fail();
    await page.goto('');
    await page.evaluate(() => {
      const s = document.createElement('script');
      s.textContent = 'window.__xtInjected = true';
      document.head.append(s);
    });
    await page.waitForTimeout(300);
  });

  test('catches an uncaught page error', async ({ page }) => {
    test.fail();
    await page.goto('');
    await page.evaluate(() =>
      setTimeout(() => {
        throw new Error('boom');
      }),
    );
    await page.waitForTimeout(300);
  });
});
