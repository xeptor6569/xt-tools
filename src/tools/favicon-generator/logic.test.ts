import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { describeFavicon, parseFavicon, pngsToIco } from './logic.ts';
import meta from './meta.ts';

describe('faviconGenerator', () => {
  it('reads a letter and optional colours', () => {
    expect(parseFavicon('Z')).toEqual({ letter: 'Z', background: '#1d4ed8', foreground: '#ffffff' });
    expect(parseFavicon('hello')).toEqual({ letter: 'H', background: '#1d4ed8', foreground: '#ffffff' });
    expect(parseFavicon('a #112233 #abcdef')).toEqual({
      letter: 'A',
      background: '#112233',
      foreground: '#abcdef',
    });
    expect(describeFavicon('')).toBe('');
  });

  it('wraps 16 and 32 PNG payloads in an ICO', () => {
    const ico = pngsToIco([
      { size: 16, png: Uint8Array.of(1, 2, 3) },
      { size: 32, png: Uint8Array.of(4, 5) },
    ]);
    expect(ico[2]).toBe(1);
    expect(ico[4]).toBe(2);
    expect(ico[6]).toBe(16);
    expect(ico[7]).toBe(16);
    expect(ico[22]).toBe(32);
    expect(ico[23]).toBe(32);
    expect([...ico.slice(38, 41)]).toEqual([1, 2, 3]);
    expect([...ico.slice(41, 43)]).toEqual([4, 5]);
    const view = new DataView(ico.buffer);
    expect(view.getUint32(14, true)).toBe(3);
    expect(view.getUint32(18, true)).toBe(38);
    expect(view.getUint32(30, true)).toBe(2);
    expect(view.getUint32(34, true)).toBe(41);
  });

  it('rejects an empty image list', () => {
    expect(() => pngsToIco([])).toThrow(ToolInputError);
  });

  it('matches the published example', () => {
    for (const example of meta.examples ?? []) expect(describeFavicon(example.input)).toContain(example.expect);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(describeFavicon);
  });
});
