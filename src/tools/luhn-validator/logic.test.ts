import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { luhnChecksumValid, luhnValidator } from './logic.ts';
import meta from './meta.ts';

describe('luhnValidator', () => {
  it('accepts the documented test number', () => {
    expect(luhnChecksumValid('4242424242424242')).toBe(true);
    expect(luhnValidator('4242 4242 4242 4242')).toContain('Luhn: valid');
    expect(luhnValidator('4242-4242-4242-4242')).toContain('4242424242424242');
  });

  it('rejects a number that fails the checksum', () => {
    expect(luhnChecksumValid('4242424242424243')).toBe(false);
    expect(luhnValidator('4242424242424243')).toContain('Luhn: invalid');
  });

  it('rejects letters', () => {
    expect(() => luhnValidator('4242 4242 4242 424a')).toThrow(ToolInputError);
  });

  it('runs the meta examples', () => {
    for (const example of meta.examples ?? []) expect(luhnValidator(example.input)).toContain(example.expect);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(luhnValidator, { malformed: ['1', '4242x', '---'] });
  });
});
