// Development tools whose real work happens in lazy chunks, workers or bundled
// datasets. meta.examples can't cover them (random or image output), so these
// checks prove those paths load under the production CSP with no external requests.
import { expect, test, waitForHydration } from './fixtures.ts';

test('mock-data generates seeded rows in its worker', async ({ page }) => {
  await page.goto('tools/mock-data/');
  await waitForHydration(page);
  await page.getByLabel('Seed').fill('42');
  await page.locator('[data-xt="input"]').fill('3');
  const output = page.locator('[data-xt="output"]').first();
  await expect(output).toHaveValue(/"email": "[^"]+@[^"]+"/, { timeout: 15_000 });
  const rows = JSON.parse(await output.inputValue()) as unknown[];
  expect(rows).toHaveLength(3);
  // Same seed, same data.
  const first = await output.inputValue();
  await page.reload();
  await waitForHydration(page);
  await page.getByLabel('Seed').fill('42');
  await page.locator('[data-xt="input"]').fill('3');
  await expect(output).toHaveValue(first, { timeout: 15_000 });
});

test('code-to-image highlights in a worker and downloads a PNG', async ({ page }) => {
  await page.goto('tools/code-to-image/');
  await waitForHydration(page);
  await page.locator('[data-xt="input"]').fill('const answer: number = 42;\nconsole.log(answer);');
  await expect(page.locator('[data-xt="image-size"]')).toHaveText(/\d+ × \d+ px/, { timeout: 15_000 });
  const canvas = page.locator('[data-xt="canvas"]');
  const size = await canvas.evaluate((c: HTMLCanvasElement) => [c.width, c.height]);
  expect(size[0]).toBeGreaterThan(100);
  expect(size[1]).toBeGreaterThan(20);
  const download = page.waitForEvent('download');
  await page.locator('[data-xt="download"]').click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/\.png$/);
  expect(file.url()).toMatch(/^blob:/);
});

test('gitignore-generator loads its bundled dataset and combines templates', async ({ page }) => {
  await page.goto('tools/gitignore-generator/');
  await waitForHydration(page);
  await page.getByRole('button', { name: 'Node', exact: true }).click();
  await page.getByRole('button', { name: 'macOS', exact: true }).click();
  const output = page.locator('[data-xt="output"]').first();
  await expect(output).toHaveValue(/### Node ###[\s\S]*node_modules\/[\s\S]*### macOS ###[\s\S]*\.DS_Store/);
});
