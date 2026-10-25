// Crawls every internal link reachable from the home page and checks it
// loads. Catches links that ignore the base path.
//
// The HTML is fetched directly. Opening each page in the browser no longer
// fits in the test timeout once the catalog is this large, and the links
// are already in the static markup.
import { expect, test } from './fixtures.ts';

const HREF_ATTR = /<a\b[^>]*?\bhref="([^"]*)"/g;

test('every internal link resolves', async ({ baseURL, request }) => {
  test.setTimeout(60_000);
  if (!baseURL) throw new Error('baseURL is not set');
  const base = new URL(baseURL);
  const queue = [base.href];
  const seen = new Set(queue);
  const broken: string[] = [];

  while (queue.length > 0) {
    const url = queue.shift() as string;
    const response = await request.get(url);
    if (!response.ok()) {
      broken.push(`${response.status()} ${url}`);
      continue;
    }
    const html = await response.text();
    for (const match of html.matchAll(HREF_ATTR)) {
      const raw = match[1] ?? '';
      if (raw === '' || raw.startsWith('#') || /^(?:mailto|javascript|data):/i.test(raw)) continue;
      let link: URL;
      try {
        link = new URL(raw, url);
      } catch {
        broken.push(`unparseable ${raw} (linked from ${url})`);
        continue;
      }
      if (link.protocol !== 'http:' && link.protocol !== 'https:') continue;
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
    const assetResponse = await request.get(asset);
    if (!assetResponse.ok()) broken.push(`${assetResponse.status()} ${asset}`);
  }

  expect(broken).toEqual([]);
  expect(seen.size).toBeGreaterThan(5);
});
