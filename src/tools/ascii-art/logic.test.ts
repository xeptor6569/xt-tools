import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { FONT_NAMES, loadFont } from './fonts.ts';
import { asciiArt } from './logic.ts';

const standard = await loadFont('Standard');

describe('asciiArt', () => {
  it('renders the classic Standard font', () => {
    expect(asciiArt('Hi', 'Standard', standard)).toBe(
      ['  _   _ _', ' | | | (_)', ' | |_| | |', ' |  _  | |', ' |_| |_|_|', ''].join('\n'),
    );
  });

  it('wraps long text to the width', () => {
    const art = asciiArt('hello wonderful world', 'Standard', standard, { width: 40 });
    expect(Math.max(...art.split('\n').map((l) => l.length))).toBeLessThanOrEqual(40);
  });

  it('every bundled font loads and renders', async () => {
    for (const name of FONT_NAMES) {
      const art = asciiArt('Ab1', name, await loadFont(name));
      expect(art.trim().length, name).toBeGreaterThan(0);
    }
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust((s) => asciiArt(s, 'Standard', standard), { timeLimitMs: 5000 });
  });
});
