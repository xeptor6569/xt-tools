import preact from '@astrojs/preact';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';
import { createHash } from 'node:crypto';
import { themeBootstrapScript } from './src/lib/theme.ts';

const basePath = process.env.BASE_PATH ?? '/';
if (!basePath.startsWith('/') || !basePath.endsWith('/')) {
  throw new Error(`BASE_PATH must start and end with "/" (got "${basePath}")`);
}
const siteUrl = process.env.SITE_URL?.trim() || undefined;
const version = process.env.VERSION?.trim() || 'dev';

// Astro doesn't hash `is:inline` scripts, so hash the theme bootstrap here.
const sha256 = (text: string) => `sha256-${createHash('sha256').update(text).digest('base64')}` as const;
const themeScriptHash = sha256(themeBootstrapScript(basePath));

// One policy for every page. scripts/gen-csp.ts copies it (plus frame-ancestors)
// into the nginx header, so keep both in sync by only editing it here.
const cspDirectives = [
  "default-src 'self'",
  "img-src 'self' blob: data:",
  "media-src 'self' blob: data:",
  "font-src 'self' data:",
  "connect-src 'self' blob: data:",
  "worker-src 'self' blob:",
  "frame-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
] as const;

export default defineConfig({
  base: basePath,
  ...(siteUrl ? { site: siteUrl } : {}),
  trailingSlash: 'always',
  build: {
    format: 'directory',
    inlineStylesheets: 'never',
  },
  integrations: [preact()],
  // Shiki's inline styles are incompatible with the CSP; no Markdown is rendered yet.
  markdown: { syntaxHighlight: false },
  security: {
    csp: {
      algorithm: 'SHA-256',
      directives: [...cspDirectives],
      scriptDirective: { resources: ["'self'", "'wasm-unsafe-eval'"], hashes: [themeScriptHash] },
      styleDirective: { resources: ["'self'"] },
    },
  },
  vite: {
    plugins: [tailwindcss()],
    define: {
      __XT_VERSION__: JSON.stringify(version),
    },
    server: {
      watch: process.env.WATCH_POLL === '1' ? { usePolling: true, interval: 300 } : {},
    },
  },
});
