import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { cspBuilder } from './logic.ts';
import meta from './meta.ts';

describe('cspBuilder', () => {
  it('joins directive lines into one policy', () => {
    expect(cspBuilder("script-src 'self'\nstyle-src 'self'")).toBe("script-src 'self'; style-src 'self'");
  });

  it('warns about unsafe-inline, unsafe-eval and wildcards', () => {
    const text = cspBuilder("script-src 'self' 'unsafe-inline' 'unsafe-eval' * *.example.com");
    expect(text).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval' * *.example.com");
    expect(text).toContain("script-src allows 'unsafe-inline'");
    expect(text).toContain("script-src allows 'unsafe-eval'");
    expect(text).toContain('script-src allows a wildcard (*)');
    expect(text).toContain('script-src allows a wildcard (*.example.com)');
  });

  it('allows a bare upgrade-insecure-requests and rejects a bare word', () => {
    expect(cspBuilder('upgrade-insecure-requests')).toBe('upgrade-insecure-requests');
    expect(() => cspBuilder('hello')).toThrow(ToolInputError);
    expect(cspBuilder('')).toBe('');
  });

  it('matches the published example', () => {
    for (const example of meta.examples ?? []) expect(cspBuilder(example.input)).toContain(example.expect);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(cspBuilder);
  });
});
