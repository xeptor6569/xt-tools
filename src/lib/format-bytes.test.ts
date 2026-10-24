import { describe, expect, it } from 'vitest';
import { formatBytes, formatEstimate } from './format-bytes.ts';

describe('formatBytes', () => {
  it('formats the units settings shows', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(12 * 1024)).toBe('12 KB');
    expect(formatBytes(2.5 * 1024 * 1024)).toBe('2.5 MB');
  });

  it('includes the quota when the browser reports one', () => {
    expect(formatEstimate(undefined, 100)).toBe('');
    expect(formatEstimate(2048, undefined)).toBe('Using 2.0 KB.');
    expect(formatEstimate(1024, 4096)).toBe('Using 1.0 KB of 4.0 KB.');
  });
});
