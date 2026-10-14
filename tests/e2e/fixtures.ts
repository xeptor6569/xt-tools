// Shared Playwright fixture. Every test automatically:
//   - aborts and fails on any request outside the site's origin,
//   - fails on CSP violations, page errors and console errors,
//   - fails on same-origin 4xx/5xx responses (unless allowed).
import AxeBuilder from '@axe-core/playwright';
import { test as base, expect, type Page } from '@playwright/test';

// Console errors that are expected and harmless, each with the reason.
const BENIGN_CONSOLE_ERRORS: RegExp[] = [
  // Chromium ignores COOP on plain-HTTP origins (e.g. http://site:8080 in the
  // e2e network). The header still applies when the site is served over HTTPS.
  /The Cross-Origin-Opener-Policy header has been ignored, because the URL's origin was untrustworthy/,
];

interface Guard {
  /** Allow same-origin 404 responses in this test (e.g. the 404 page itself). */
  allowNotFound(): void;
}

export const test = base.extend<{ guard: Guard }>({
  guard: [
    async ({ page, baseURL }, use) => {
      if (!baseURL) throw new Error('baseURL is not set');
      const origin = new URL(baseURL).origin;
      const external: string[] = [];
      const errors: string[] = [];
      const violations: string[] = [];
      const failed: string[] = [];
      let allowNotFound = false;

      await page.context().route('**/*', (route) => {
        const url = route.request().url();
        if (new URL(url).origin === origin) return route.continue();
        external.push(url);
        return route.abort('blockedbyclient');
      });

      await page.exposeFunction('__xtReportCsp', (v: string) => violations.push(v));
      await page.addInitScript(() => {
        document.addEventListener('securitypolicyviolation', (e) => {
          const report = (window as unknown as { __xtReportCsp: (v: string) => void }).__xtReportCsp;
          report(`${e.effectiveDirective} blocked ${e.blockedURI || 'inline'} at ${e.sourceFile}:${e.lineNumber}`);
        });
      });

      page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
      page.on('console', (m) => {
        if (m.type() !== 'error') return;
        if (allowNotFound && /Failed to load resource.*404/.test(m.text())) return;
        if (BENIGN_CONSOLE_ERRORS.some((re) => re.test(m.text()))) return;
        errors.push(`console.error: ${m.text()}`);
      });
      page.on('response', (r) => {
        if (new URL(r.url()).origin !== origin || r.status() < 400) return;
        if (allowNotFound && r.status() === 404) return;
        failed.push(`${r.status()} ${r.url()}`);
      });

      await use({ allowNotFound: () => (allowNotFound = true) });

      expect(external, 'requests to other origins').toEqual([]);
      expect(violations, 'CSP violations').toEqual([]);
      expect(errors, 'page errors').toEqual([]);
      expect(failed, 'failed same-origin responses').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/** Waits until every Astro island on the page has hydrated. */
export async function waitForHydration(page: Page): Promise<void> {
  await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
}

/** Runs axe in light and dark colour schemes and expects no violations. */
export async function expectAccessible(page: Page): Promise<void> {
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    const summary = results.violations.map(
      (v) => `[${colorScheme}] ${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`,
    );
    expect(summary, `axe violations (${colorScheme})`).toEqual([]);
  }
  await page.emulateMedia({ colorScheme: null });
}
