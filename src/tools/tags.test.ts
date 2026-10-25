import { describe, expect, it } from 'vitest';
import { deriveTags } from './tags.ts';

describe('deriveTags', () => {
  it('prefers keyword words, then the name, and stops at four', () => {
    expect(deriveTags('CI two-pane', ['ci', 'two pane', 'worker'])).toEqual(['ci', 'two', 'pane', 'worker']);
  });

  it('falls back to a label when the name has no usable word', () => {
    expect(deriveTags('A', ['!'])).toEqual(['tool']);
  });
});
