import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { urlEncoder } from './logic.ts';
import meta from './meta.ts';

const value = (input: string, label: string) => urlEncoder(input).find((v) => v.label === label)?.value;

describe('urlEncoder', () => {
  it('encodes with encodeURIComponent', () => {
    expect(value('a b', 'Encoded')).toBe('a%20b');
    expect(value('a b', 'Auto')).toBe('a%20b');
    expect(value("a/b?x=1&y=2#'", 'Encoded')).toBe("a%2Fb%3Fx%3D1%26y%3D2%23'");
  });

  it('decodes percent-encoding and picks that automatically', () => {
    expect(value('a%20b', 'Decoded')).toBe('a b');
    expect(value('a%20b', 'Auto')).toBe('a b');
    expect(value('%3A%2F%2F', 'Decoded')).toBe('://');
  });

  it('round-trips encoded text', () => {
    const encoded = value('hello world', 'Encoded') ?? '';
    expect(value(encoded, 'Decoded')).toBe('hello world');
  });

  it('encodes a stray percent sign instead of treating it as an escape', () => {
    expect(value('100%', 'Auto')).toBe('100%25');
    expect(value('100%', 'Decoded')).toBe('100%');
  });

  it('matches the published example', () => {
    for (const example of meta.examples ?? []) {
      expect(
        urlEncoder(example.input)
          .map((v) => v.value)
          .join('\n'),
      ).toContain(example.expect);
    }
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(urlEncoder);
  });
});
