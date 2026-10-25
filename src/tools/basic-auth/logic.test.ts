import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { basicAuth } from './logic.ts';
import meta from './meta.ts';

describe('basicAuth', () => {
  it('matches the RFC 7617 example', () => {
    expect(basicAuth('Aladdin:open sesame')).toBe('Authorization: Basic QWxhZGRpbjpvcGVuIHNlc2FtZQ==');
  });

  it('encodes UTF-8 and keeps colons that belong to the password', () => {
    expect(basicAuth('user:pass')).toBe('Authorization: Basic dXNlcjpwYXNz');
    expect(basicAuth('user:päss')).toBe('Authorization: Basic dXNlcjpww6Rzcw==');
    expect(basicAuth('user:a:b')).toBe(`Authorization: Basic ${btoa('user:a:b')}`);
  });

  it('rejects a value with no colon and ignores surrounding space', () => {
    expect(() => basicAuth('only-a-name')).toThrow(ToolInputError);
    expect(basicAuth('  user:pass  ')).toBe('Authorization: Basic dXNlcjpwYXNz');
    expect(basicAuth('')).toBe('');
  });

  it('matches the published example', () => {
    for (const example of meta.examples ?? []) expect(basicAuth(example.input)).toContain(example.expect);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(basicAuth);
  });
});
