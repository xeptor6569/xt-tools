import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { decodeBase64, encodeFile, sniffMime } from './logic.ts';

const PNG_1PX = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

describe('base64 file conversion', () => {
  it('encodes bytes as Base64 and a data URI', () => {
    expect(encodeFile(new TextEncoder().encode('hi'), 'text/plain')).toEqual({
      base64: 'aGk=',
      dataUri: 'data:text/plain;base64,aGk=',
    });
  });

  it('sniffs the type when the browser gives none', () => {
    const png = decodeBase64(PNG_1PX).bytes;
    expect(sniffMime(png)).toBe('image/png');
    expect(encodeFile(png, '').dataUri.startsWith('data:image/png;base64,')).toBe(true);
  });

  it('decodes raw Base64, URL-safe Base64 and data URIs', () => {
    expect(decodeBase64(PNG_1PX)).toMatchObject({ mime: 'image/png', extension: 'png' });
    expect(new TextDecoder().decode(decodeBase64('aGk').bytes)).toBe('hi');
    expect(decodeBase64('data:application/json;charset=utf-8;base64,e30=')).toMatchObject({
      mime: 'application/json',
      extension: 'json',
    });
    expect([...decodeBase64('-_8').bytes]).toEqual([0xfb, 0xff]);
  });

  it('round-trips binary data', () => {
    const bytes = Uint8Array.from({ length: 1000 }, (_, i) => (i * 37) % 256);
    expect(decodeBase64(encodeFile(bytes, '').dataUri).bytes).toEqual(bytes);
  });

  it('rejects invalid input', () => {
    expect(() => decodeBase64('not base64!!')).toThrow(ToolInputError);
    expect(() => decodeBase64('data:text/plain,hello')).toThrow(/Only Base64 data URIs/);
    expect(() => decodeBase64('   ')).toThrow(ToolInputError);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(decodeBase64);
    expectRobust((s) => encodeFile(new TextEncoder().encode(s), ''));
  });
});
