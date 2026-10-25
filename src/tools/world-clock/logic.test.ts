import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { worldClock } from './logic.ts';

const noon = new Date('2026-01-01T15:04:05Z');

describe('worldClock', () => {
  it('lists each zone and a time in that zone', () => {
    const text = worldClock('UTC, America/New_York, Europe/London, Asia/Tokyo', noon);
    expect(text).toContain('UTC  01/01/2026, 15:04:05');
    expect(text).toContain('America/New_York  01/01/2026, 10:04:05');
    expect(text).toContain('Europe/London  01/01/2026, 15:04:05');
    expect(text).toContain('Asia/Tokyo  02/01/2026, 00:04:05');
  });

  it('uses the default zones when the input is empty', () => {
    const text = worldClock('', noon);
    expect(text).toContain('UTC');
    expect(text).toContain('America/New_York');
    expect(text).toContain('Europe/London');
    expect(text).toContain('Asia/Tokyo');
  });

  it('rejects an unknown zone', () => {
    expect(() => worldClock('Not/AZone', noon)).toThrow(ToolInputError);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust((input) => worldClock(input, noon));
  });
});
