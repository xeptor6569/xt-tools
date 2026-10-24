// Scans the built site for anything that could make a network request to
// another origin, including code that comes from dependencies. See PLAN.md
// section 9.2.
import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { NETWORK_HOSTS } from '../src/lib/network-allow.ts';
import { ROOT } from './lib/tools.ts';
import { walk } from './lib/fs.ts';

const DIST = join(ROOT, 'dist');
const ABSOLUTE = /^(?:[a-z][a-z0-9+.-]*:)?\/\//i;

interface AllowEntry {
  prefix: string;
  reason: string;
}

const allow = (
  JSON.parse(readFileSync(join(ROOT, 'scripts', 'scan-dist.allow.json'), 'utf8')) as { allow: AllowEntry[] }
).allow.concat(
  NETWORK_HOSTS.map((origin) => ({
    prefix: origin,
    reason: 'Allowlisted network-tool host. Fetched only by networkFetch after the user runs the tool.',
  })),
);
const allowed = (url: string) => allow.some((a) => url.startsWith(a.prefix));

/** Attributes that make the browser fetch something automatically. */
const RESOURCE_ATTR =
  /<(script|img|iframe|frame|source|video|audio|embed|object|track|input|image|use)\b[^>]*?\s(src|srcset|data|poster|href|xlink:href)\s*=\s*["']([^"']*)["']/gi;
const LINK_TAG = /<link\b[^>]*>/gi;
const NON_FETCHING_REL = /\brel\s*=\s*["']?(canonical|alternate|me|author|license|help|search)\b/i;
const JS_LOADERS: Array<[RegExp, string]> = [
  [/\bimport\s*\(\s*["'`](?:https?:)?\/\//g, 'dynamic import() of an absolute URL'],
  [/\bimportScripts\s*\(\s*["'`](?:https?:)?\/\//g, 'importScripts() of an absolute URL'],
  [/\bnew\s+(?:Shared)?Worker\s*\(\s*["'`](?:https?:)?\/\//g, 'Worker from an absolute URL'],
  [/\bfetch\s*\(\s*["'`](?:https?:)?\/\//g, 'fetch() of an absolute URL'],
  [/\bnew\s+WebSocket\s*\(/g, 'WebSocket'],
  [/\bnew\s+EventSource\s*\(\s*["'`](?:https?:)?\/\//g, 'EventSource to an absolute URL'],
  [/\bsendBeacon\s*\(/g, 'navigator.sendBeacon'],
  [/\bnew\s+RTCPeerConnection\s*\(/g, 'RTCPeerConnection'],
];

export function scanHtml(html: string): string[] {
  const problems: string[] = [];
  for (const m of html.matchAll(RESOURCE_ATTR)) {
    const value = m[3] ?? '';
    const urls =
      m[2]?.toLowerCase() === 'srcset' ? value.split(',').map((s) => s.trim().split(/\s+/)[0] ?? '') : [value];
    for (const url of urls) if (ABSOLUTE.test(url)) problems.push(`<${m[1]} ${m[2]}="${url}"> loads another origin`);
  }
  for (const m of html.matchAll(LINK_TAG)) {
    const tag = m[0];
    const hrefValue = /\shref\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1] ?? '';
    if (ABSOLUTE.test(hrefValue) && !NON_FETCHING_REL.test(tag)) problems.push(`${tag} loads another origin`);
  }
  if (/<meta\b[^>]*http-equiv\s*=\s*["']?refresh/i.test(html))
    problems.push('<meta http-equiv="refresh"> is not allowed');
  if (/<base\b/i.test(html)) problems.push('<base> is not allowed');
  for (const m of html.matchAll(/<form\b[^>]*\saction\s*=\s*["']([^"']*)["']/gi)) {
    if (ABSOLUTE.test(m[1] ?? '')) problems.push(`<form action="${m[1]}"> posts to another origin`);
  }
  // CSP blocks these, so catch them at build time with a clear message.
  for (const m of html.matchAll(/<[a-z][^>]*\sstyle\s*=\s*["'][^"']*["']/gi)) {
    problems.push(`inline style attribute (blocked by CSP): ${m[0].slice(0, 80)}`);
  }
  for (const m of html.matchAll(/<[a-z][^>]*\son[a-z]+\s*=\s*["']/gi)) {
    problems.push(`inline event handler (blocked by CSP): ${m[0].slice(0, 80)}`);
  }
  return problems;
}

export function scanCss(css: string): string[] {
  const problems: string[] = [];
  for (const m of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) {
    if (ABSOLUTE.test(m[1] ?? '')) problems.push(`url(${m[1]}) loads another origin`);
  }
  for (const m of css.matchAll(/@import\s+(?:url\()?\s*["']?([^"');\s]+)/gi)) {
    if (ABSOLUTE.test(m[1] ?? '')) problems.push(`@import ${m[1]} loads another origin`);
  }
  return problems;
}

export function scanJs(js: string): string[] {
  const problems: string[] = [];
  for (const [re, label] of JS_LOADERS) if (re.test(js)) problems.push(label);
  for (const m of js.matchAll(/(?:https?:)?\/\/[a-z0-9.-]+\.[a-z]{2,}[^\s"'`)<>\\]*/gi)) {
    const url = m[0];
    if (!/^https?:/i.test(url)) continue; // protocol-relative matches are mostly comments or regexes
    if (!allowed(url))
      problems.push(`absolute URL ${url} (add to scripts/scan-dist.allow.json with a reason if it is never fetched)`);
  }
  return [...new Set(problems)];
}

if (import.meta.main) {
  const problems: string[] = [];
  let files = 0;
  for (const file of walk(DIST)) {
    const name = relative(DIST, file);
    const scanner = file.endsWith('.html')
      ? scanHtml
      : file.endsWith('.css')
        ? scanCss
        : /\.m?js$/.test(file)
          ? scanJs
          : null;
    if (!scanner) continue;
    const found = scanner(readFileSync(file, 'utf8'));
    files++;
    problems.push(...found.map((p) => `${name}: ${p}`));
  }
  if (problems.length > 0) {
    console.error(`scan-dist: ${problems.length} problem(s):`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log(`scan-dist: ${files} file(s) clean.`);
}
