import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { unicodeNormalizer } from './logic.ts';

const as = (s: string) => Object.fromEntries(unicodeNormalizer(s).map((v) => [v.label, v.value]));

describe('unicodeNormalizer', () => {
  it('composes and decomposes accents', () => {
    const decomposed = 'e\u0301';
    expect(as(decomposed).NFC).toBe('\u00e9');
    expect(as('\u00e9').NFD).toBe(decomposed);
  });

  it('folds compatibility characters', () => {
    expect(as('ﬁ ① Ｈ ℌ').NFKC).toBe('fi 1 H H');
    expect(as('ﬁ').NFC).toBe('ﬁ');
  });

  it('removes accents', () => {
    expect(as('Crème brûlée, Ångström')['Without accents']).toBe('Creme brulee, Angstrom');
  });

  it('says when nothing changes', () => {
    expect(unicodeNormalizer('plain')[0]?.note).toMatch(/Already in this form/);
    expect(unicodeNormalizer('e\u0301')[0]?.note).toMatch(/2 → 1 code points/);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(unicodeNormalizer, { timeLimitMs: 5000 });
  });
});
