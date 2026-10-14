import { describe, expect, it } from 'vitest';
import { parsePolicy, serializePolicy } from '../../scripts/gen-csp.ts';
import { licenseAllowed } from '../../scripts/lib/licenses.ts';
import { slugify, toCamelCase, toPascalCase } from '../../scripts/lib/tools.ts';
import { scanCss, scanHtml, scanJs } from '../../scripts/scan-dist.ts';

describe('licenseAllowed', () => {
  const allow = ['MIT', 'Apache-2.0'];
  it.each([
    ['MIT', true],
    ['GPL-3.0', false],
    ['(MIT OR GPL-3.0)', true],
    ['MIT AND Apache-2.0', true],
    ['MIT AND GPL-3.0', false],
    ['UNKNOWN', false],
  ])('%s → %s', (expr, ok) => expect(licenseAllowed(expr, allow)).toBe(ok));
});

describe('CSP policy parsing', () => {
  it('round-trips', () => {
    const policy = "default-src 'self'; script-src 'self' 'sha256-abc='";
    expect(serializePolicy(parsePolicy(policy))).toBe(policy);
  });
});

describe('scan-dist', () => {
  it('flags external resources in HTML', () => {
    expect(scanHtml('<script src="https://cdn.example/x.js"></script>')).toHaveLength(1);
    expect(scanHtml('<img srcset="/a.png 1x, //cdn.example/b.png 2x">')).toHaveLength(1);
    expect(scanHtml('<link rel="stylesheet" href="https://fonts.example/css">')).toHaveLength(1);
    expect(scanHtml('<link rel="preconnect" href="https://fonts.example">')).toHaveLength(1);
    expect(scanHtml('<div style="color:red"></div>')).toHaveLength(1);
    expect(scanHtml('<button onclick="x()"></button>')).toHaveLength(1);
  });

  it('allows same-origin resources, canonical links and plain anchors', () => {
    expect(scanHtml('<script src="/_astro/x.js"></script><link rel="canonical" href="https://example.com/">')).toEqual(
      [],
    );
    expect(scanHtml('<a href="https://github.com/">source</a>')).toEqual([]);
  });

  it('flags external CSS imports and urls', () => {
    expect(scanCss('@import url("https://fonts.example/x.css");')).not.toHaveLength(0);
    expect(scanCss('a{background:url(https://x.example/a.png)}')).toHaveLength(1);
    expect(scanCss('a{background:url(/a.png)}')).toEqual([]);
  });

  it('flags network loaders and unknown URLs in JS', () => {
    expect(scanJs('fetch("https://api.example/x")').join()).toMatch(/fetch/);
    expect(scanJs('new WebSocket(u)').join()).toMatch(/WebSocket/);
    expect(scanJs('const u = "https://tracker.example/p"').join()).toMatch(/tracker\.example/);
    expect(scanJs('const ns = "http://www.w3.org/2000/svg"')).toEqual([]);
  });
});

describe('script helpers', () => {
  it('slugify', () => expect(slugify('JWT Debugger (v2)!')).toBe('jwt-debugger-v2'));
  it('case helpers', () => {
    expect(toPascalCase('ipv4-subnet')).toBe('Ipv4Subnet');
    expect(toCamelCase('ipv4-subnet')).toBe('ipv4Subnet');
  });
});
