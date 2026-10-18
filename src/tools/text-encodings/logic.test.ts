import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { decodeFrom, ENCODINGS, encodeAll, qpEncode, utf7Encode } from './logic.ts';

// Expected values generated with Python's quopri and "utf-7" codec.
describe('quoted-printable', () => {
  it.each([
    ['Hi', 'Hi'],
    ['café', 'caf=C3=A9'],
    ['a=b', 'a=3Db'],
    ['line1\nline2', 'line1\nline2'],
    ['x'.repeat(80), `${'x'.repeat(75)}=\nxxxxx`],
    ['tab\tend ', 'tab\tend=20'],
    ['日本', '=E6=97=A5=E6=9C=AC'],
  ])('%j', (text, qp) => {
    expect(qpEncode(text)).toBe(qp);
    expect(decodeFrom(qp, 'quoted-printable')).toBe(text);
  });

  it('accepts lower-case escapes and CRLF soft breaks', () => {
    expect(decodeFrom('caf=c3=a9=\r\n!', 'quoted-printable')).toBe('café!');
    expect(() => decodeFrom('=ZZ', 'quoted-printable')).toThrow(ToolInputError);
  });
});

describe('UTF-7', () => {
  it.each([
    ['café', 'caf+AOk-'],
    ['Hi Mom -☺-!', 'Hi Mom -+Jjo--!'],
    ['A≢Α.', 'A+ImIDkQ.'],
    ['日本語', '+ZeVnLIqe-'],
    ['~\\', '+AH4AXA-'],
    ['a+b', 'a+-b'],
    ['🚀', '+2D3egA-'],
  ])('%j', (text, utf7) => {
    expect(utf7Encode(text)).toBe(utf7);
    expect(decodeFrom(utf7, 'utf-7')).toBe(text);
  });

  it('rejects a lone "+"', () => {
    expect(() => decodeFrom('a+', 'utf-7')).toThrow(ToolInputError);
  });
});

describe('UTF-16 and percent-encoding', () => {
  const as = (s: string) => Object.fromEntries(encodeAll(s).map((v) => [v.label, v.value]));
  it('encodes code units in both byte orders', () => {
    expect(as('é🚀')['UTF-16 BE (hex)']).toBe('00 E9 D8 3D DE 80');
    expect(as('é🚀')['UTF-16 LE (hex)']).toBe('E9 00 3D D8 80 DE');
    expect(decodeFrom('00E9 D83D DE80', 'utf-16be')).toBe('é🚀');
    expect(decodeFrom('e900', 'utf-16le')).toBe('é');
  });

  it('percent-encodes everything but unreserved characters', () => {
    expect(as('a b/é~')['Percent-encoding']).toBe('a%20b%2F%C3%A9~');
    expect(decodeFrom('a+b%2F%C3%A9', 'percent')).toBe('a b/é');
    expect(() => decodeFrom('%E0%A4%A', 'percent')).toThrow(ToolInputError);
  });

  it('round-trips every encoding', () => {
    const s = 'Ünïcödé 👩‍👩‍👧 a+b=c ~\\ \tend';
    const encoded = encodeAll(s);
    ENCODINGS.forEach(({ value }, i) => expect(decodeFrom(encoded[i]!.value, value)).toBe(s));
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(encodeAll, { timeLimitMs: 5000 });
    for (const { value } of ENCODINGS) expectRobust((s) => decodeFrom(s, value), { timeLimitMs: 5000 });
  });
});
