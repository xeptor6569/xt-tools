import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ogMetaTags } from './logic.ts';
import meta from './meta.ts';

describe('ogMetaTags', () => {
  it('writes Open Graph and Twitter tags', () => {
    const text = ogMetaTags('Hello | A page | https://example.com | https://example.com/a.png');
    expect(text).toContain('<meta property="og:title" content="Hello" />');
    expect(text).toContain('<meta property="og:description" content="A page" />');
    expect(text).toContain('<meta property="og:url" content="https://example.com" />');
    expect(text).toContain('<meta property="og:image" content="https://example.com/a.png" />');
    expect(text).toContain('<meta name="twitter:card" content="summary_large_image" />');
  });

  it('escapes attribute values and omits empty fields', () => {
    const text = ogMetaTags('A & B | <hi>');
    expect(text).toContain('content="A &amp; B"');
    expect(text).toContain('content="&lt;hi&gt;"');
    expect(text).not.toContain('og:url');
    expect(text).toContain('content="summary"');
  });

  it('returns nothing when every field is empty', () => {
    expect(ogMetaTags('')).toBe('');
    expect(ogMetaTags(' |  |  | ')).toBe('');
  });

  it('matches the published example', () => {
    for (const example of meta.examples ?? []) expect(ogMetaTags(example.input)).toContain(example.expect);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(ogMetaTags);
  });
});
