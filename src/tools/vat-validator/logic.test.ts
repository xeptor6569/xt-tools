import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { vatValidator } from './logic.ts';
import meta from './meta.ts';

describe('vatValidator', () => {
  it('accepts real-format samples and says the check is format-only', () => {
    for (const sample of [
      'DE136695976',
      'de 136.695.976',
      'FR40303265045',
      'FRXX123456789',
      'GB123456789',
      'NL123456789B01',
      'IT12345678901',
      'ESA1234567Z',
      'SE123456789012',
      'PL1234567890',
    ]) {
      const output = vatValidator(sample);
      expect(output).toContain('format-only');
      expect(output).toContain('no VIES');
    }
    expect(vatValidator('DE136695976')).toContain('Germany');
  });

  it('rejects a bad shape and letters that France excludes', () => {
    expect(() => vatValidator('DE13669597')).toThrow(ToolInputError);
    expect(() => vatValidator('FRIO123456789')).toThrow(ToolInputError);
    expect(() => vatValidator('US123456789')).toThrow(/format only/);
  });

  it('runs the meta examples', () => {
    for (const example of meta.examples ?? []) expect(vatValidator(example.input)).toContain(example.expect);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(vatValidator, { malformed: ['DE', '123', '##'] });
  });
});
