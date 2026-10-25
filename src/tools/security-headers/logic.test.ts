import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { securityHeaders } from './logic.ts';
import meta from './meta.ts';

describe('securityHeaders', () => {
  it('emits the default block for an empty extra field', () => {
    const text = securityHeaders('');
    expect(text).toContain('X-Content-Type-Options: nosniff');
    expect(text).toContain('X-Frame-Options: DENY');
    expect(text).toContain('Referrer-Policy: no-referrer');
    expect(text).toContain("Content-Security-Policy: default-src 'self'");
    expect(text).toContain('Permissions-Policy: camera=(), microphone=(), geolocation=()');
  });

  it('honours options and appends a valid extra header', () => {
    const text = securityHeaders('X-Test: 1', {
      frame: 'SAMEORIGIN',
      referrer: 'same-origin',
      nosniff: false,
      csp: "default-src 'none'",
    });
    expect(text).not.toContain('nosniff');
    expect(text).toContain('X-Frame-Options: SAMEORIGIN');
    expect(text).toContain('Referrer-Policy: same-origin');
    expect(text).toContain("Content-Security-Policy: default-src 'none'");
    expect(text).toContain('X-Test: 1');
  });

  it('rejects an extra line that is not a header', () => {
    expect(() => securityHeaders('hello')).toThrow(ToolInputError);
  });

  it('matches the published example', () => {
    for (const example of meta.examples ?? []) expect(securityHeaders(example.input)).toContain(example.expect);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(securityHeaders);
  });
});
