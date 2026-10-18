import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { numeronym, numeronymWord } from './logic.ts';

describe('numeronym', () => {
  it.each([
    ['internationalization', 'i18n'],
    ['localization', 'l10n'],
    ['accessibility', 'a11y'],
    ['Kubernetes', 'K8s'],
    ['cat', 'cat'],
  ])('%s → %s', (word, expected) => expect(numeronymWord(word)).toBe(expected));

  it('works on whole sentences and keeps punctuation', () => {
    expect(numeronym('Internationalization and localization, please!')).toBe('I18n and l10n, p4e!');
    expect(numeronym('hello world', 6)).toBe('hello world');
  });

  it('counts characters, not code units', () => {
    expect(numeronymWord('Ünïcödé')).toBe('Ü5é');
  });

  it('validates the minimum length', () => {
    expect(() => numeronym('x', 1)).toThrow(ToolInputError);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust((s) => numeronym(s));
  });
});
