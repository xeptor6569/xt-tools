import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { punycode } from './logic.ts';
import { decode, encode } from './punycode.ts';

describe('RFC 3492 sample strings (section 7.1)', () => {
  it.each([
    ['(A) Arabic', 'ليهمابتكلموشعربي؟', 'egbpdaj6bu4bxfgehfvwxn'],
    ['(B) Chinese (simplified)', '他们为什么不说中文', 'ihqwcrb4cv8a8dqg056pqjye'],
    ['(L) 3B', '3年B組金八先生', '3B-ww4c5e180e575a65lsy2b'],
    ['(N) Japanese', 'パフィーdeルンバ', 'de-jg4avhby1noc0d'],
    ['ASCII-only with delimiter', 'abc', 'abc-'],
  ])('%s', (_name, unicode, puny) => {
    expect(encode(unicode)).toBe(puny);
    expect(decode(puny)).toBe(unicode);
  });

  it('(I) Russian, case-folded', () => {
    expect(encode('почемужеонинеговорятпорусски')).toBe('b1abfaaepdrnnbgefbadotcwatmq2g4l');
  });
});

describe('domains', () => {
  it('encodes and decodes each label', () => {
    expect(punycode('münchen.de')).toBe('xn--mnchen-3ya.de');
    expect(punycode('xn--mnchen-3ya.de')).toBe('münchen.de');
    expect(punycode('Bücher.Example')).toBe('xn--bcher-kva.example');
    expect(punycode('日本語。jp')).toBe('xn--wgv71a119e.jp');
    expect(punycode('user@bücher.de')).toBe('user@xn--bcher-kva.de');
  });

  it('converts line by line', () => {
    expect(punycode('münchen.de\n\nexample.com')).toBe('xn--mnchen-3ya.de\n\nexample.com');
  });

  it('rejects invalid Punycode', () => {
    expect(() => punycode('xn--a€b.com')).toThrow(ToolInputError);
    expect(() => punycode('xn--99999999999.com')).toThrow(ToolInputError);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(punycode, { malformed: ['xn--', 'xn---', '...', 'xn--zzzzzzzzzzzzzzzz'] });
  });
});
