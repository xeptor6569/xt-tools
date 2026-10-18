import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { loadEmoji } from './data.ts';
import { codePoints, searchEmoji, withSkin } from './logic.ts';

const data = await loadEmoji();

describe('emoji picker', () => {
  it('loads the full emoji list with groups and shortcodes', () => {
    expect(data.emoji.length).toBeGreaterThan(1800);
    expect(data.groups.map((g) => g.label)).toContain('Smileys & emotion');
    expect(data.emoji.find((e) => e.emoji === '👍')?.shortcodes).toContain('+1');
  });

  it('searches names, tags and shortcodes', () => {
    expect(searchEmoji(data.emoji, 'waving hand')[0]?.emoji).toBe('👋');
    expect(searchEmoji(data.emoji, ':rocket:').map((e) => e.emoji)).toContain('🚀');
    expect(searchEmoji(data.emoji, 'thumbs up').map((e) => e.emoji)).toContain('👍');
    expect(searchEmoji(data.emoji, '🚀').map((e) => e.emoji)).toEqual(['🚀']);
  });

  it('filters by group', () => {
    const smileys = data.groups.find((g) => g.label === 'Smileys & emotion')!.id;
    expect(searchEmoji(data.emoji, '', smileys).every((e) => e.group === smileys)).toBe(true);
  });

  it('applies skin tones and shows code points', () => {
    const wave = data.emoji.find((e) => e.emoji === '👋')!;
    expect(withSkin(wave, 3)).toBe('👋🏽');
    expect(
      withSkin(
        data.emoji.find((e) => e.emoji === '🚀')!,
        3,
      ),
    ).toBe('🚀');
    expect(codePoints('👋🏽')).toBe('U+1F44B U+1F3FD');
  });

  it('survives empty, huge and malformed queries', () => {
    expectRobust((q) => searchEmoji(data.emoji, q));
  });
});
