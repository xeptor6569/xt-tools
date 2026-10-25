import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { barcodeGenerator, code128Bits, eanCheckDigit, encodeBarcode } from './logic.ts';
import meta from './meta.ts';

const EAN_590 = '10100010110100111011001100100110111101001110101010110011011011001000010101110010011101000100101';

describe('barcodeGenerator', () => {
  it('adds the EAN-13 check digit and encodes the bars', () => {
    expect(eanCheckDigit('590123412345')).toBe(7);
    expect(barcodeGenerator('ean 590123412345')).toBe('EAN-13 5901234123457');
    expect(barcodeGenerator('ean 5901 2341 2345')).toContain('5901234123457');
    const code = encodeBarcode('ean 5901234123457');
    expect(code?.bits).toBe(EAN_590);
    expect(code?.bits).toHaveLength(95);
    expect(code?.bits.slice(45, 50)).toBe('01010');
  });

  it('rejects a wrong EAN check digit', () => {
    expect(() => barcodeGenerator('ean 5901234123458')).toThrow(ToolInputError);
    expect(barcodeGenerator('')).toBe('');
  });

  it('encodes Code 128 set B with the mod-103 checksum', () => {
    const bits = code128Bits('HI');
    expect(bits.startsWith('11010010000')).toBe(true);
    expect(bits.slice(11, 22)).toBe('11000101000');
    expect(bits.slice(22, 33)).toBe('11000100010');
    expect(bits.slice(33, 44)).toBe('11001001110');
    expect(bits.endsWith('1100011101011')).toBe(true);
    expect(bits).toHaveLength(57);
    expect(barcodeGenerator('code128 Hello')).toBe('Code 128B Hello');
    expect(barcodeGenerator('Hello')).toBe('Code 128B Hello');
  });

  it('rejects characters outside set B', () => {
    expect(() => barcodeGenerator('café')).toThrow(ToolInputError);
    expect(() => barcodeGenerator('code128 ')).toThrow(ToolInputError);
  });

  it('matches the published examples', () => {
    for (const example of meta.examples ?? []) expect(barcodeGenerator(example.input)).toContain(example.expect);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(barcodeGenerator);
  });
});
