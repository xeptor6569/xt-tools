import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { ascii85Decode, ascii85Encode } from './ascii85.ts';
import { baseEncoder, ENCODINGS, type Encoding } from './logic.ts';

const enc = (s: string, e: Encoding) => baseEncoder(s, e, 'encode').text;
const dec = (s: string, e: Encoding) => baseEncoder(s, e, 'decode').text;

describe('RFC 4648 test vectors', () => {
  it.each([
    ['', '', ''],
    ['f', 'Zg==', 'MY======'],
    ['fo', 'Zm8=', 'MZXQ===='],
    ['foo', 'Zm9v', 'MZXW6==='],
    ['foob', 'Zm9vYg==', 'MZXW6YQ='],
    ['fooba', 'Zm9vYmE=', 'MZXW6YTB'],
    ['foobar', 'Zm9vYmFy', 'MZXW6YTBOI======'],
  ])('%j', (text, b64, b32) => {
    expect(enc(text, 'base64')).toBe(b64);
    expect(enc(text, 'base32')).toBe(b32);
    if (text) {
      expect(dec(b64, 'base64')).toBe(text);
      expect(dec(b32, 'base32')).toBe(text);
    }
  });

  it('hex', () => {
    expect(enc('foobar', 'hex')).toBe('666f6f626172');
    expect(dec('0x666F6F', 'hex')).toBe('foo');
  });
});

describe('other encodings', () => {
  it('base64url has no padding and uses - and _', () => {
    expect(enc('\u00ff\u00fe?', 'base64url')).toBe('w7_Dvj8');
    expect(dec('w7_Dvj8', 'base64url')).toBe('\u00ff\u00fe?');
  });

  it('base58 (Bitcoin alphabet)', () => {
    expect(enc('Hello World!', 'base58')).toBe('2NEpo7TZRRrLZSi2U');
    expect(dec('2NEpo7TZRRrLZSi2U', 'base58')).toBe('Hello World!');
  });

  it.each([
    ['M', '9`'],
    ['Man', '9jqo'],
    ['Man ', '9jqo^'],
    ['sure.', 'F*2M7/c'],
    ['Hello, World!', '87cURD_*#4DfTZ)+T'],
  ])('ascii85 %j → %j', (text, expected) => {
    expect(enc(text, 'ascii85')).toBe(expected);
    expect(dec(expected, 'ascii85')).toBe(text);
  });

  it('ascii85 zero groups and delimiters', () => {
    expect(ascii85Encode(new Uint8Array([0, 0, 0, 0, 0x78]))).toBe('zGQ');
    expect([...ascii85Decode('<~zGQ~>')]).toEqual([0, 0, 0, 0, 0x78]);
    expect([...ascii85Decode('s8W-!')]).toEqual([255, 255, 255, 255]);
  });
});

describe('decoding', () => {
  it('ignores whitespace and missing padding', () => {
    expect(dec('Zm9v\nYmFy', 'base64')).toBe('foobar');
    expect(dec('Zm8', 'base64')).toBe('fo');
  });

  it('shows binary results as hex', () => {
    expect(baseEncoder('/w==', 'base64', 'decode')).toEqual({ text: 'ff', binary: true });
  });

  it('rejects invalid input with a clear message', () => {
    expect(() => dec('not base64!', 'base64')).toThrow(ToolInputError);
    expect(() => dec('0OIl', 'base58')).toThrow(/valid Base58/);
    expect(() => dec('abc', 'hex')).toThrow(ToolInputError);
    expect(() => dec('~~~', 'ascii85')).toThrow(ToolInputError);
  });

  it('round-trips unicode in every encoding', () => {
    const text = 'Ünïcödé 日本語 🚀';
    for (const { value } of ENCODINGS) expect(dec(enc(text, value), value)).toBe(text);
  });
});

describe('robustness', () => {
  for (const { value } of ENCODINGS) {
    it(`${value} survives empty, huge and malformed input`, () => {
      expectRobust((s) => baseEncoder(s, value, 'encode'), { timeLimitMs: 5000 });
      expectRobust((s) => baseEncoder(s, value, 'decode'), { timeLimitMs: 5000 });
    });
  }
});

describe('limits', () => {
  it('handles the largest allowed Base58 input quickly', () => {
    const start = performance.now();
    const text = 'x'.repeat(2048);
    expect(dec(enc(text, 'base58'), 'base58')).toBe(text);
    expect(performance.now() - start).toBeLessThan(2000);
    expect(() => enc('x'.repeat(2049), 'base58')).toThrow(/limited to 2048 bytes/);
  });
});
