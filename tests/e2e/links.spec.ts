// Crawls every internal link reachable from the home page and checks it
// loads. Catches links that ignore the base path.
import { expect, test } from './fixtures.ts';

test('every internal link resolves', async ({ page, baseURL, request }) => {
  if (!baseURL) throw new Error('baseURL is not set');
  const base = new URL(baseURL);
  const queue = [base.href];
  const seen = new Set(queue);
  const broken: string[] = [];

  while (queue.length > 0) {
    const url = queue.shift() as string;
    const response = await page.goto(url);
    if (!response || response.status() !== 200) {
      broken.push(`${response?.status() ?? 'no response'} ${url}`);
      continue;
    }
    const hrefs = await page.locator('a[href]').evaluateAll((links) => links.map((a) => (a as HTMLAnchorElement).href));
    for (const raw of hrefs) {
      const link = new URL(raw);
      link.hash = '';
      if (link.origin !== base.origin || seen.has(link.href)) continue;
      seen.add(link.href);
      if (!link.pathname.startsWith(base.pathname)) {
        broken.push(`outside base path: ${link.href} (linked from ${url})`);
        continue;
      }
      queue.push(link.href);
    }
  }

  for (const asset of ['search-index.json', 'favicon.svg']) {
    const r = await request.get(asset);
    if (!r.ok()) broken.push(`${r.status()} ${asset}`);
  }

  expect(broken).toEqual([]);
  expect(seen.size).toBeGreaterThan(5);
});
