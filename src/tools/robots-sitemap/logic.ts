import { ToolInputError } from '../types.ts';

const MAX_INPUT = 1_000_000;
const DIRECTIVE = /^(user-agent|allow|disallow|sitemap|crawl-delay)\s*:\s*(\S.*)$/i;

function xml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function directiveName(name: string): string {
  const lower = name.toLowerCase();
  if (lower === 'user-agent') return 'User-agent';
  if (lower === 'crawl-delay') return 'Crawl-delay';
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

/** Build robots.txt from User-agent/Allow/Disallow lines and a urlset from http(s) URLs. */
export function robotsSitemap(input: string): string {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 1 MB).');
  const trimmed = input.trim();
  if (trimmed === '') return '';
  const robots: string[] = [];
  const urls: string[] = [];
  let sawAgent = false;
  for (const raw of trimmed.split(/\n/)) {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) continue;
    const match = DIRECTIVE.exec(line);
    if (match) {
      const name = directiveName(match[1] ?? '');
      const value = (match[2] ?? '').trim();
      if (name === 'User-agent') sawAgent = true;
      robots.push(`${name}: ${value}`);
      continue;
    }
    if (/^https?:\/\//i.test(line)) {
      urls.push(line.split(/\s/)[0] ?? line);
      continue;
    }
    throw new ToolInputError(`Unrecognised line: ${line.slice(0, 80)}`);
  }
  if (!sawAgent) robots.unshift('User-agent: *');
  const sitemap = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((url) => `  <url><loc>${xml(url)}</loc></url>`),
    '</urlset>',
  ].join('\n');
  return `# robots.txt\n${robots.join('\n')}\n\n# sitemap.xml\n${sitemap}`;
}
