import { describe, expect, it } from 'vitest';
import { expectRobustAsync } from '../../../tests/helpers/expect-robust.ts';
import { isToolInputError } from '../types.ts';
import { phoneParser } from './logic.ts';
import meta from './meta.ts';

describe('phoneParser', () => {
  it('parses a UK number in international form', async () => {
    const output = await phoneParser('+442071838750');
    expect(output).toContain('+442071838750');
    expect(output).toContain('+44');
    expect(output).toContain('United Kingdom');
    expect(output).toContain('Status: valid');
  });

  it('reads a national number as a US number', async () => {
    const output = await phoneParser('(415) 555-2671');
    expect(output).toContain('+14155552671');
    expect(output).toContain('US');
    expect(output).toContain('Status: valid');
  });

  it('returns an invalid line for a parsed but impossible number', async () => {
    const output = await phoneParser('123');
    expect(output).toContain('Status: invalid');
  });

  it('throws for text that is not a phone number', async () => {
    await expect(phoneParser('not a phone')).rejects.toSatisfy(isToolInputError);
  });

  it('runs the meta examples', async () => {
    for (const example of meta.examples ?? []) {
      expect(await phoneParser(example.input)).toContain(example.expect);
    }
  });

  it('survives empty, huge and malformed input', async () => {
    await expectRobustAsync(phoneParser);
  });
});
