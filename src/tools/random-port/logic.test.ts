import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { KNOWN_PORTS } from './data.ts';
import {
  knownPortsIn,
  parseCount,
  parseExclusions,
  parsePort,
  randomPorts,
  rangeBounds,
  uniformBelow,
  type RandomBytes,
} from './logic.ts';

const zeros: RandomBytes = (n) => new Uint8Array(n);

/** Returns 16-bit values from a list, big-endian, one per call of random(2). */
function sequence(values: number[]): RandomBytes {
  let i = 0;
  return (n) => {
    const v = values[i++ % values.length]!;
    const out = new Uint8Array(n);
    out[0] = v >> 8;
    out[1] = v & 0xff;
    return out;
  };
}

/** A simple deterministic generator, good enough to spread values around in tests. */
function lcg(seed = 1): RandomBytes {
  let s = seed >>> 0;
  return (n) => {
    const out = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      out[i] = s >>> 24;
    }
    return out;
  };
}

const registered = { range: 'registered', skipKnown: true } as const;

describe('parseCount', () => {
  it('parses the count field', () => {
    expect(parseCount('')).toBe(1);
    expect(parseCount(' 5 ')).toBe(5);
    expect(parseCount('1000')).toBe(1000);
    expect(() => parseCount('0')).toThrow(ToolInputError);
    expect(() => parseCount('1001')).toThrow(ToolInputError);
    expect(() => parseCount('abc')).toThrow(ToolInputError);
    expect(() => parseCount('-3')).toThrow(ToolInputError);
  });

  it('survives empty, huge and malformed count input', () => {
    expectRobust(parseCount);
  });
});

describe('parsePort and parseExclusions', () => {
  it('accepts 1–65535 only', () => {
    expect(parsePort('1', 'Min')).toBe(1);
    expect(parsePort(' 65535 ', 'Max')).toBe(65535);
    expect(() => parsePort('0', 'Min')).toThrow(/Min/);
    expect(() => parsePort('65536', 'Max')).toThrow(ToolInputError);
    expect(() => parsePort('80.5', 'Max')).toThrow(ToolInputError);
    expect(() => parsePort('', 'Max')).toThrow(ToolInputError);
  });

  it('parses single ports and ranges', () => {
    expect([...parseExclusions('8001, 8100-8102;9999\n8001')].sort((a, b) => a - b)).toEqual([
      8001, 8100, 8101, 8102, 9999,
    ]);
    expect(parseExclusions('  ').size).toBe(0);
    expect(parseExclusions('1-65535').size).toBe(65535);
    expect(() => parseExclusions('9000-8000')).toThrow(/backwards/);
    expect(() => parseExclusions('http')).toThrow(ToolInputError);
  });

  it('survives empty, huge and malformed exclusion input', () => {
    expectRobust(parseExclusions, { malformed: ['1-65535 '.repeat(1200), '-1', '1--2', '99999'] });
  });
});

describe('rangeBounds', () => {
  it('knows the IANA ranges', () => {
    expect(rangeBounds({ range: 'registered' })).toEqual({ min: 1024, max: 49151 });
    expect(rangeBounds({ range: 'dynamic' })).toEqual({ min: 49152, max: 65535 });
    expect(rangeBounds({ range: 'unprivileged' })).toEqual({ min: 1024, max: 65535 });
    expect(rangeBounds({ range: 'custom', min: 10, max: 20 })).toEqual({ min: 10, max: 20 });
    expect(() => rangeBounds({ range: 'custom', min: 20, max: 10 })).toThrow(ToolInputError);
    expect(() => rangeBounds({ range: 'custom' })).toThrow(ToolInputError);
  });
});

describe('uniformBelow', () => {
  it('is exactly uniform over one full cycle of 16-bit values', () => {
    // Every 16-bit value once, in a scrambled order (odd multipliers are bijections mod 2^16).
    const all = Array.from({ length: 65536 }, (_, i) => Math.imul(i, 40503) & 0xffff);
    const random = sequence(all);
    for (const n of [3, 7, 1000, 40000]) {
      const counts = new Map<number, number>();
      const limit = 65536 - (65536 % n);
      // Each accepted value appears once per cycle; rejected ones are skipped.
      for (let i = 0; i < limit; i++) {
        const v = uniformBelow(n, random);
        counts.set(v, (counts.get(v) ?? 0) + 1);
      }
      expect(counts.size).toBe(n);
      expect(new Set(counts.values())).toEqual(new Set([limit / n]));
    }
  });

  it('rejects values in the biased tail', () => {
    // 65535 is ≥ the limit for n = 3 (65535), so it's skipped and 4 is used: 4 % 3 = 1.
    expect(uniformBelow(3, sequence([65535, 4]))).toBe(1);
  });

  it('gives up on a broken random source instead of looping forever', () => {
    expect(() => uniformBelow(3, sequence([65535]))).toThrow(/random source/);
  });
});

describe('randomPorts', () => {
  it('generates the requested number of unique ports in the range', () => {
    const ports = randomPorts(1000, registered, lcg(7));
    expect(ports).toHaveLength(1000);
    expect(new Set(ports).size).toBe(1000);
    for (const p of ports) {
      expect(p).toBeGreaterThanOrEqual(1024);
      expect(p).toBeLessThanOrEqual(49151);
    }
  });

  it('is deterministic for an injected random source', () => {
    // All-zero randomness always picks the first remaining candidate.
    expect(randomPorts(3, registered, zeros)).toEqual([1024, 1025, 1026]);
    expect(randomPorts(3, { range: 'dynamic', skipKnown: false }, zeros)).toEqual([49152, 49153, 49154]);
  });

  it('skips well-known ports by default and keeps them when asked', () => {
    const custom = { range: 'custom', min: 3000, max: 3001 } as const;
    expect(() => randomPorts(1, { ...custom, skipKnown: true }, zeros)).toThrow(/only has 0 usable ports/);
    expect(randomPorts(2, { ...custom, skipKnown: false, sort: true }, lcg())).toEqual([3000, 3001]);
    const ports = randomPorts(1000, { range: 'custom', min: 5000, max: 9999, skipKnown: true }, lcg(3));
    for (const k of KNOWN_PORTS) expect(ports).not.toContain(k.port);
  });

  it('honours extra exclusions', () => {
    const exclude = parseExclusions('1024-1030');
    expect(randomPorts(2, { ...registered, exclude }, zeros)).toEqual([1031, 1032]);
  });

  it('can use every port of a small range exactly once', () => {
    const ports = randomPorts(11, { range: 'custom', min: 60000, max: 60010, skipKnown: true }, lcg(11));
    expect([...ports].sort((a, b) => a - b)).toEqual(Array.from({ length: 11 }, (_, i) => 60000 + i));
    expect(() => randomPorts(12, { range: 'custom', min: 60000, max: 60010, skipKnown: true }, lcg())).toThrow(
      /only has 11 usable ports, fewer than the 12 requested/,
    );
  });

  it('sorts on request', () => {
    const ports = randomPorts(50, { ...registered, sort: true }, lcg(5));
    expect(ports).toEqual([...ports].sort((a, b) => a - b));
  });

  it('spreads picks across the range', () => {
    // 1000 draws over the dynamic range: each quarter should get a fair share.
    const ports = randomPorts(1000, { range: 'dynamic', skipKnown: false }, lcg(42));
    const quarters = [0, 0, 0, 0];
    for (const p of ports) quarters[Math.floor(((p - 49152) * 4) / 16384)]!++;
    for (const q of quarters) expect(q).toBeGreaterThan(180);
  });
});

describe('known ports data', () => {
  it('has unique, valid, sorted ports with service names', () => {
    const ports = KNOWN_PORTS.map((k) => k.port);
    expect(new Set(ports).size).toBe(ports.length);
    expect(ports).toEqual([...ports].sort((a, b) => a - b));
    for (const k of KNOWN_PORTS) {
      expect(k.port).toBeGreaterThan(0);
      expect(k.port).toBeLessThanOrEqual(65535);
      expect(k.service.length).toBeGreaterThan(1);
    }
    expect(knownPortsIn(1024, 49151).map((k) => k.port)).toEqual(
      expect.arrayContaining([3000, 3306, 5000, 5173, 5432, 6379, 8000, 8080, 8443, 9000, 9090, 9200, 27017]),
    );
    expect(knownPortsIn(1024, 49151).some((k) => k.port < 1024)).toBe(false);
  });
});
