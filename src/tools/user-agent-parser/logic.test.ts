import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { userAgentParser } from './logic.ts';
import meta from './meta.ts';

const CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

describe('userAgentParser', () => {
  it('reads browser, version, OS and engine', () => {
    const text = userAgentParser(CHROME);
    expect(text).toContain('browser: Chrome');
    expect(text).toContain('version: 120.0.0.0');
    expect(text).toContain('os: Windows');
    expect(text).toContain('engine: Blink');
  });

  it('names unknown fields instead of throwing', () => {
    expect(userAgentParser('hello')).toContain('browser: (unknown)');
    expect(userAgentParser('')).toBe('');
  });

  it('matches the published example', () => {
    for (const example of meta.examples ?? []) expect(userAgentParser(example.input)).toContain(example.expect);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(userAgentParser);
  });
});
