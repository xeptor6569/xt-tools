import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { urlParser } from './logic.ts';
import meta from './meta.ts';

describe('urlParser', () => {
  it('lists the parts and masks the password', () => {
    const text = urlParser('https://ada:secret@example.com:8443/a/b?x=1&y=2&x=3#top');
    expect(text).toContain('origin: https://example.com:8443');
    expect(text).toContain('protocol: https:');
    expect(text).toContain('username: ada');
    expect(text).toContain('password: ••••');
    expect(text).not.toContain('secret');
    expect(text).toContain('host: example.com');
    expect(text).toContain('port: 8443');
    expect(text).toContain('pathname: /a/b');
    expect(text).toContain('query: x, y');
    expect(text).toContain('hash: #top');
  });

  it('leaves the password blank and marks the default port', () => {
    const text = urlParser('https://example.com/');
    expect(text).toContain('password: \n');
    expect(text).toContain('port: (default)');
    expect(text).not.toContain('••••');
  });

  it('rejects a relative path', () => {
    expect(() => urlParser('/just/a/path')).toThrow(ToolInputError);
    expect(urlParser('')).toBe('');
    expect(urlParser('   ')).toBe('');
  });

  it('matches the published example', () => {
    for (const example of meta.examples ?? []) expect(urlParser(example.input)).toContain(example.expect);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(urlParser);
  });
});
