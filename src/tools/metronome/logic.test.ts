import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { beatIntervalMs, parseBpm } from './logic.ts';

describe('metronome', () => {
  it('converts BPM to a beat interval', () => {
    expect(parseBpm('120')).toBe(120);
    expect(beatIntervalMs(120)).toBe(500);
    expect(beatIntervalMs(60)).toBe(1000);
  });

  it('rejects tempos outside 20–300', () => {
    expect(() => parseBpm('10')).toThrow(ToolInputError);
    expect(() => parseBpm('400')).toThrow(ToolInputError);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(parseBpm);
  });
});
