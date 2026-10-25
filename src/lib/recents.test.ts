import { describe, expect, it } from 'vitest';
import { MAX_RECENTS, rememberRecent, sanitizeRecents } from './recents.ts';

describe('recents', () => {
  it('keeps the newest visit first and drops duplicates', () => {
    expect(rememberRecent(['slugify'], 'uuid-generator')).toEqual(['uuid-generator', 'slugify']);
    expect(rememberRecent(['uuid-generator', 'slugify'], 'slugify')).toEqual(['slugify', 'uuid-generator']);
  });

  it('caps the list at 12', () => {
    const ids = Array.from({ length: MAX_RECENTS }, (_, index) => `tool-${index}`);
    const next = rememberRecent(ids, 'tool-extra');
    expect(next).toHaveLength(MAX_RECENTS);
    expect(next[0]).toBe('tool-extra');
    expect(next).not.toContain('tool-11');
  });

  it('rejects ids that are not tool ids', () => {
    expect(rememberRecent(['slugify'], '../etc')).toEqual(['slugify']);
    expect(rememberRecent(['slugify'], '')).toEqual(['slugify']);
  });

  it('reads a stored list and drops unknown tools', () => {
    expect(sanitizeRecents({ ids: ['slugify', 'slugify', 'nope', 1, 'uuid-generator'] }, new Set(['slugify']))).toEqual(
      ['slugify'],
    );
    expect(sanitizeRecents(null)).toEqual([]);
    expect(sanitizeRecents({ ids: 'slugify' })).toEqual([]);
  });
});
