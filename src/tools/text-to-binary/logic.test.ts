import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { textToBinary } from './logic.ts';

const enc = (s: string, f: 'binary' | 'octal' | 'decimal' | 'hex' = 'binary') => textToBinary(s, f, 'encode').text;
const dec = (s: string, f: 'binary' | 'octal' | 'decimal' | 'hex' = 'binary') => textToBinary(s, f, 'decode');

describe('textToBinary', () => {
  it('encodes UTF-8 bytes in each format', () => {
    expect(enc('Hi')).toBe('01001000 01101001');
    expect(enc('Hi', 'octal')).toBe('110 151');
    expect(enc('Hi', 'decimal')).toBe('72 105');
    expect(enc('é', 'hex')).toBe('c3 a9');
  });

  it('decodes with or without separators', () => {
    expect(dec('01001000 01101001').text).toBe('Hi');
    expect(dec('0100100001101001').text).toBe('Hi');
    expect(dec('48,69', 'hex').text).toBe('Hi');
    expect(dec('0x48 0x69', 'hex').text).toBe('Hi');
    expect(dec('72 105', 'decimal').text).toBe('Hi');
  });

  it('shows invalid UTF-8 as hex', () => {
    expect(dec('11111111')).toEqual({ text: 'ff', binary: true });
  });

  it('rejects bad digits and out-of-range bytes', () => {
    expect(() => dec('0102')).toThrow(ToolInputError);
    expect(() => dec('256', 'decimal')).toThrow(/0–255/);
    expect(() => dec('0101010', 'binary')).not.toThrow();
    expect(() => dec('010101010', 'binary')).toThrow(/groups of 8/);
  });

  it('round-trips unicode', () => {
    const s = 'Ünïcödé 🚀';
    for (const f of ['binary', 'octal', 'decimal', 'hex'] as const) expect(dec(enc(s, f), f).text).toBe(s);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust((s) => textToBinary(s));
    expectRobust((s) => textToBinary(s, 'hex', 'decode'));
  });
});
