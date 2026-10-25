import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { htmlEntities } from './logic.ts';
import meta from './meta.ts';

const value = (input: string, label: string) => htmlEntities(input).find((v) => v.label === label)?.value;

describe('htmlEntities', () => {
  it('escapes the five HTML specials', () => {
    expect(value('a<b>&"', 'Escaped')).toBe('a&lt;b&gt;&amp;&quot;');
    expect(value("'", 'Escaped')).toBe('&#39;');
  });

  it('decodes named and numeric entities', () => {
    expect(value('&lt;b&gt;&amp;&quot;&#39;', 'Unescaped')).toBe('<b>&"\'');
    expect(value('&#65;&#x42;', 'Unescaped')).toBe('AB');
    expect(value('&nbsp;&copy;', 'Unescaped')).toBe('\u00A0\u00A9');
  });

  it('round-trips the common characters', () => {
    for (const sample of ['&', '<', '>', '"', "'", 'a<b>&"\'']) {
      const escaped = value(sample, 'Escaped') ?? '';
      expect(value(escaped, 'Unescaped')).toBe(sample);
    }
  });

  it('decodes one level and leaves unknown names alone', () => {
    expect(value('&amp;lt;', 'Unescaped')).toBe('&lt;');
    expect(value('&notanentity;', 'Unescaped')).toBe('&notanentity;');
    expect(value('&#x110000;', 'Unescaped')).toBe('\uFFFD');
  });

  it('matches the published example', () => {
    for (const example of meta.examples ?? []) {
      expect(
        htmlEntities(example.input)
          .map((v) => v.value)
          .join('\n'),
      ).toContain(example.expect);
    }
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(htmlEntities);
  });
});
