import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { cidrTools } from './logic.ts';

describe('cidrTools', () => {
  it('aggregates adjacent prefixes and ignores input order', () => {
    const forward = cidrTools('10.0.0.0/24\n10.0.1.0/24\n');
    const reverse = cidrTools('10.0.1.0/24\n10.0.0.0/24\n');
    expect(forward).toBe(reverse);
    expect(forward).toContain('Aggregated\n10.0.0.0/23\n');
    expect(forward).toContain('Overlaps\nNone');
  });

  it('rolls four /24s into a /22 and leaves an unaligned pair alone', () => {
    expect(cidrTools('10.0.0.0/24\n10.0.1.0/24\n10.0.2.0/24\n10.0.3.0/24')).toContain('10.0.0.0/22');
    const split = cidrTools('10.0.1.0/24\n10.0.2.0/24');
    expect(split).toContain('10.0.1.0/24\n10.0.2.0/24');
    expect(split).not.toContain('/23');
  });

  it('lists containment and duplicate lines, sorted', () => {
    const text = cidrTools('192.168.0.0/24\n10.1.2.0/24\n10.0.0.0/8\n10.0.0.0/8\n');
    expect(text.startsWith('Aggregated\n10.0.0.0/8\n192.168.0.0/24\n')).toBe(true);
    expect(text).toContain('10.0.0.0/8 contains 10.1.2.0/24');
    expect(text).toContain('10.0.0.0/8 listed 2 times');
    const overlap = text.split('Overlaps\n')[1] ?? '';
    expect(overlap.split('\n')).toEqual([...overlap.split('\n')].sort());
  });

  it('normalizes host bits and skips comments', () => {
    expect(cidrTools('10.1.2.3/8\n# note\n')).toContain('10.0.0.0/8');
  });

  it('rejects a bad prefix and returns nothing for empty input', () => {
    expect(cidrTools('')).toBe('');
    expect(cidrTools('# only a comment\n\n')).toBe('');
    expect(() => cidrTools('10.0.0.0/33')).toThrow(ToolInputError);
    expect(() => cidrTools('not-a-cidr')).toThrow(ToolInputError);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(cidrTools, { malformed: ['10.0.0.0/', '/24', '10.0.0.1/24 extra'] });
  });
});
