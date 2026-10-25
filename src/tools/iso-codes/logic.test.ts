import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { codesFor, isoCodes } from './logic.ts';
import meta from './meta.ts';

describe('isoCodes', () => {
  it('resolves country, currency and language codes', () => {
    expect(isoCodes('US')).toContain('United States');
    expect(isoCodes('US')).toContain('Country:');
    expect(isoCodes('USD')).toContain('US Dollar');
    expect(isoCodes('en')).toContain('English');
    expect(isoCodes('DE')).toContain('Germany');
    expect(isoCodes('DE')).toContain('German');
  });

  it('searches by name, including when the region list API is missing', () => {
    expect(codesFor('region', ['US'])).toEqual(['US']);
    expect(codesFor('currency', [])).toContain('USD');
    expect(isoCodes('united')).toContain('United States');
    expect(isoCodes('dollar')).toContain('US Dollar');
    expect(isoCodes('french')).toContain('French');
  });

  it('rejects an unknown name', () => {
    expect(() => isoCodes('zzzznotacode')).toThrow(ToolInputError);
  });

  it('runs the meta examples', () => {
    for (const example of meta.examples ?? []) expect(isoCodes(example.input)).toContain(example.expect);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(isoCodes, { malformed: ['?', 'x'.repeat(100)] });
  });
});
