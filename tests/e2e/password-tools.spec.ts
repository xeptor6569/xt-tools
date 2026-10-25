// Password strength, the password/passphrase generator, and the openssl rand
// stand-in. Their output is random, so meta.examples cannot check it.
import { expect, test, waitForHydration } from './fixtures.ts';

test('password strength scores a common password', async ({ page }) => {
  await page.goto('tools/password-strength/');
  await waitForHydration(page);
  await page.locator('[data-xt="input"]').fill('password');
  await expect(page.locator('[data-xt="output"]')).toHaveValue(/common/i, { timeout: 15_000 });
});

test('password generator makes a password and an EFF passphrase', async ({ page }) => {
  await page.goto('tools/password-generator/');
  await waitForHydration(page);
  await page.getByLabel(/Length/).fill('12');
  const output = page.locator('[data-xt="output"] textarea');
  await expect(output).toHaveValue(/^.{12}$/);
  await page.getByLabel('Kind').selectOption('passphrase');
  await expect(output).toHaveValue(/^[a-z]+(?: [a-z]+){5}$/, { timeout: 15_000 });
});

test('random bytes follows openssl rand encodings and downloads raw bytes', async ({ page }) => {
  await page.goto('tools/token-generator/');
  await waitForHydration(page);
  const output = page.locator('[data-xt="output"] textarea');
  await expect(output).toHaveValue(/^[0-9a-f]{64}$/);
  await expect(page.getByText('openssl rand -hex 32')).toBeVisible();
  await page.getByLabel('Encoding').selectOption('base64');
  await expect(output).toHaveValue(/^[A-Za-z0-9+/]{43}=$/);
  await page.getByLabel('Encoding').selectOption('binary');
  await expect(output).toHaveValue('32 bytes, raw binary.');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download raw' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('random.bin');
  expect(file.url()).toMatch(/^blob:/);
});
