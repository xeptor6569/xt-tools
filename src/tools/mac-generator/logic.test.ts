import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { macGenerator, parseCount } from './logic.ts';

const fixed = (byte: number) => (n: number) => new Uint8Array(n).fill(byte);

describe('macGenerator', () => {
  it('sets the local and unicast bits by default', () => {
    expect(macGenerator(1, fixed(0xff))).toEqual(['FE:FF:FF:FF:FF:FF']);
    expect(macGenerator(1, fixed(0x00))).toEqual(['02:00:00:00:00:00']);
  });

  it('can clear the local bit or set the multicast bit', () => {
    expect(macGenerator(1, fixed(0xff), { local: false, unicast: true })).toEqual(['FC:FF:FF:FF:FF:FF']);
    expect(macGenerator(1, fixed(0x00), { local: true, unicast: false })).toEqual(['03:00:00:00:00:00']);
    expect(macGenerator(1, fixed(0xff), { local: false, unicast: false })).toEqual(['FD:FF:FF:FF:FF:FF']);
  });

  it('formats every address and keeps the requested count', () => {
    const addresses = macGenerator(4, fixed(0x11));
    expect(addresses).toHaveLength(4);
    for (const address of addresses) expect(address).toMatch(/^[0-9A-F]{2}(?::[0-9A-F]{2}){5}$/);
  });

  it('rejects a bad count or a short buffer', () => {
    expect(() => macGenerator(0, fixed(1))).toThrow(ToolInputError);
    expect(() => macGenerator(1, () => new Uint8Array(2))).toThrow(ToolInputError);
  });
});

describe('parseCount', () => {
  it('parses and limits the count', () => {
    expect(parseCount('')).toBe(1);
    expect(parseCount('10')).toBe(10);
    expect(() => parseCount('0')).toThrow(ToolInputError);
    expect(() => parseCount('nope')).toThrow(ToolInputError);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(parseCount);
  });
});
