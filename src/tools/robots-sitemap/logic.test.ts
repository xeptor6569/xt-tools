import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { robotsSitemap } from './logic.ts';
import meta from './meta.ts';

describe('robotsSitemap', () => {
  it('writes robots.txt and a urlset', () => {
    const text = robotsSitemap('User-agent: *\nDisallow: /private\nAllow: /private/public\nhttps://example.com/a');
    expect(text).toContain('User-agent: *');
    expect(text).toContain('Disallow: /private');
    expect(text).toContain('Allow: /private/public');
    expect(text).toContain('<loc>https://example.com/a</loc>');
    expect(text).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
  });

  it('adds a default user-agent and escapes sitemap locations', () => {
    const text = robotsSitemap('Disallow: /admin\nhttps://example.com/a?x=1&y=2');
    expect(text).toContain('User-agent: *\nDisallow: /admin');
    expect(text).toContain('<loc>https://example.com/a?x=1&amp;y=2</loc>');
  });

  it('rejects an unknown line', () => {
    expect(() => robotsSitemap('hello')).toThrow(ToolInputError);
    expect(robotsSitemap('')).toBe('');
  });

  it('matches the published example', () => {
    for (const example of meta.examples ?? []) expect(robotsSitemap(example.input)).toContain(example.expect);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(robotsSitemap);
  });
});
