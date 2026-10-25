import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { prepareHtml, wrapSelection } from './logic.ts';
import meta from './meta.ts';

describe('htmlEditor', () => {
  it('returns the source so a preview can show it', () => {
    expect(prepareHtml('<p>Hello</p>')).toBe('<p>Hello</p>');
    expect(prepareHtml('')).toBe('');
  });

  it('wraps the selection by editing the string', () => {
    expect(wrapSelection('Hello', 0, 5, '<strong>', '</strong>')).toEqual({
      text: '<strong>Hello</strong>',
      start: 8,
      end: 13,
    });
    expect(wrapSelection('ab', 2, 0, '<em>', '</em>').text).toBe('<em>ab</em>');
  });

  it('matches the published example', () => {
    for (const example of meta.examples ?? []) expect(prepareHtml(example.input)).toContain(example.expect);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(prepareHtml);
  });
});
