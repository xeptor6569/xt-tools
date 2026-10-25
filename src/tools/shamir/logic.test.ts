import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { shamir } from './logic.ts';

const zeros = (n: number) => new Uint8Array(n);
const counter = (start = 1) => {
  let n = start;
  return (len: number) => {
    const out = new Uint8Array(len);
    for (let i = 0; i < len; i++) out[i] = (n++ * 17) & 0xff;
    return out;
  };
};

describe('shamir', () => {
  it('joins shares of a degenerate polynomial back to the secret', () => {
    // Zero coefficients make every share a copy of the secret bytes 68 69 ("hi").
    const out = shamir('mode: join\n1: 6869\n2: 6869');
    expect(out).toBe('hi');
  });

  it('round-trips a secret with fixed random bytes', () => {
    const shares = shamir('mode: split\nthreshold: 3\nshares: 5\ncorrect horse', counter());
    const lines = shares.split('\n');
    expect(lines).toHaveLength(5);
    const subset = ['mode: join', lines[0], lines[2], lines[4]].join('\n');
    expect(shamir(subset)).toBe('correct horse');
    expect(shamir(['mode: join', lines[1], lines[3]].join('\n'))).not.toBe('correct horse');
  });

  it('is deterministic for the same random bytes', () => {
    const a = shamir('mode: split\nthreshold: 2\nshares: 3\nsecret', zeros);
    const b = shamir('mode: split\nthreshold: 2\nshares: 3\nsecret', zeros);
    expect(a).toBe(b);
    expect(shamir(`mode: join\n${a}`)).toBe('secret');
  });

  it('rejects a threshold above the share count', () => {
    expect(() => shamir('mode: split\nthreshold: 4\nshares: 2\nsecret', zeros)).toThrow(ToolInputError);
  });

  it('returns nothing for an empty box', () => {
    expect(shamir('')).toBe('');
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust((input) => shamir(input, zeros));
  });
});
