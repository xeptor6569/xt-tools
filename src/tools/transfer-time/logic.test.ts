import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { transferTime } from './logic.ts';

describe('transferTime', () => {
  it('converts GiB at megabits and GB at megabytes', () => {
    expect(transferTime('1.5 GiB at 100 Mbps')).toBe('128.849 seconds (2 min 8.849 sec)');
    expect(transferTime('1 GB at 1 MB/s')).toBe('1000 seconds (16 min 40 sec)');
    expect(transferTime('1 GB at 1 Gbps')).toBe('8 seconds');
    expect(transferTime('1 GiB at 1 GiB/s')).toBe('1 second');
  });

  it('treats MB/s as bytes and Mbps as bits', () => {
    expect(transferTime('8 MB at 1 MB/s')).toBe('8 seconds');
    expect(transferTime('8 MB at 1 Mbps')).toBe('64 seconds (1 min 4 sec)');
    expect(transferTime('2 MiB at 1 MB/s')).toBe('2.097 seconds');
  });

  it('accepts a missing space and a zero size', () => {
    expect(transferTime('1.5GiB at 100Mbps')).toBe(transferTime('1.5 GiB at 100 Mbps'));
    expect(transferTime('0 B at 100 Mbps')).toBe('0 seconds');
  });

  it('rejects an unknown unit, a zero rate, and empty input is blank', () => {
    expect(transferTime('')).toBe('');
    expect(() => transferTime('1.5 GiB')).toThrow(ToolInputError);
    expect(() => transferTime('1.5 GiB at 0 Mbps')).toThrow(ToolInputError);
    expect(() => transferTime('1.5 widgets at 100 Mbps')).toThrow(ToolInputError);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(transferTime, { malformed: ['1 GB at', 'at 100 Mbps', '-1 GB at 1 Mbps'] });
  });
});
