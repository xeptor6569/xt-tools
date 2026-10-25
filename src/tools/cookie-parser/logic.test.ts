import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { cookieParser } from './logic.ts';
import meta from './meta.ts';

describe('cookieParser', () => {
  it('parses a Cookie header', () => {
    expect(cookieParser('Cookie: a=1; b=2')).toBe('kind: Cookie\na: 1\nb: 2');
  });

  it('parses Set-Cookie attributes, including a date that contains a comma', () => {
    const text = cookieParser(
      'Set-Cookie: session=abc; Path=/; HttpOnly; Secure; SameSite=Lax; Expires=Wed, 21 Oct 2015 07:28:00 GMT',
    );
    expect(text).toContain('kind: Set-Cookie');
    expect(text).toContain('name: session');
    expect(text).toContain('value: abc');
    expect(text).toContain('Path: /');
    expect(text).toContain('HttpOnly: true');
    expect(text).toContain('Secure: true');
    expect(text).toContain('SameSite: Lax');
    expect(text).toContain('Expires: Wed, 21 Oct 2015 07:28:00 GMT');
  });

  it('detects Set-Cookie when the prefix is omitted', () => {
    expect(cookieParser('session=abc; Path=/; HttpOnly')).toContain('HttpOnly: true');
  });

  it('rejects a bare word', () => {
    expect(() => cookieParser('hello')).toThrow(ToolInputError);
    expect(cookieParser('')).toBe('');
  });

  it('matches the published example', () => {
    for (const example of meta.examples ?? []) expect(cookieParser(example.input)).toContain(example.expect);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(cookieParser);
  });
});
