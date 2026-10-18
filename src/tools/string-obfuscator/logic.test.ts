import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { stringObfuscator } from './logic.ts';

describe('stringObfuscator', () => {
  it('keeps the first and last four characters by default', () => {
    expect(stringObfuscator('sk_live_1234567890abcdef')).toBe('sk_l••••••••••••••••cdef');
  });

  it('keeps separators when asked', () => {
    expect(
      stringObfuscator('john.doe@example.com', { keepStart: 1, keepEnd: 0, keepSeparators: true, maskChar: '*' }),
    ).toBe('j***.***@*******.***');
  });

  it('can hide the length', () => {
    expect(stringObfuscator('supersecretpassword', { keepStart: 2, keepEnd: 2, fixedLength: 5 })).toBe('su•••••rd');
  });

  it('never reveals more than the string has', () => {
    expect(stringObfuscator('abc')).toBe('abc');
    expect(stringObfuscator('abcdef', { keepStart: 4, keepEnd: 4 })).toBe('abcdef');
    expect(stringObfuscator('abcdefghij', { keepStart: 0, keepEnd: 0 })).toBe('••••••••••');
  });

  it('works line by line and with emoji', () => {
    expect(stringObfuscator('🔑🔑🔑🔑🔑🔑\nabcdefghij', { keepStart: 1, keepEnd: 1 })).toBe('🔑••••🔑\na••••••••j');
  });

  it('validates options', () => {
    expect(() => stringObfuscator('x', { maskChar: '**' })).toThrow(ToolInputError);
    expect(() => stringObfuscator('x', { keepStart: -1 })).toThrow(ToolInputError);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust((s) => stringObfuscator(s));
  });
});
