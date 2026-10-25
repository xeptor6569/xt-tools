import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { groupIban, ibanMod97, ibanValidator } from './logic.ts';
import meta from './meta.ts';

describe('ibanValidator', () => {
  it('accepts the well-known GB and DE examples', () => {
    expect(ibanMod97('GB82WEST12345698765432')).toBe(1);
    expect(ibanMod97('DE89370400440532013000')).toBe(1);
    expect(ibanMod97('FR1420041010050500013M02606')).toBe(1);
    const output = ibanValidator('gb82 west 1234 5698 7654 32');
    expect(output).toContain('Valid IBAN');
    expect(output).toContain('GB82 WEST 1234 5698 7654 32');
    expect(output).toContain('United Kingdom');
    expect(groupIban('DE89370400440532013000')).toBe('DE89 3704 0044 0532 0130 00');
  });

  it('rejects a bad MOD-97 checksum', () => {
    expect(ibanMod97('GB82WEST12345698765433')).not.toBe(1);
    expect(() => ibanValidator('GB82WEST12345698765433')).toThrow(ToolInputError);
    expect(() => ibanValidator('GB82WEST12345698765433')).toThrow(/MOD-97/);
  });

  it('rejects the wrong length for a known country', () => {
    expect(() => ibanValidator('GB82WEST1234569876543')).toThrow(/22 characters/);
  });

  it('runs the meta examples', () => {
    for (const example of meta.examples ?? []) expect(ibanValidator(example.input)).toContain(example.expect);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(ibanValidator, { malformed: ['GB00', '!!', 'DE00'] });
  });
});
