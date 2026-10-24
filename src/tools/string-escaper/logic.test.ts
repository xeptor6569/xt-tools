import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { MODES, stringEscaper, type EscapeMode, type EscapeOptions } from './logic.ts';
import meta from './meta.ts';

const esc = (input: string, mode: EscapeMode, options: Partial<EscapeOptions> = {}) =>
  stringEscaper(input, { ...options, mode, direction: 'escape' });
const unesc = (input: string, mode: EscapeMode, options: Partial<EscapeOptions> = {}) =>
  stringEscaper(input, { ...options, mode, direction: 'unescape' });

const SAMPLE = 'He said "hi"\n\tit\'s 50% $HOME `x` ${y} \\ é € 🚀 \u0001\u007f\u2028 a,b;c <&> [.*]';

describe('JSON', () => {
  it('escapes like JSON.stringify', () => {
    expect(esc('He said "hi"', 'json')).toBe('He said \\"hi\\"');
    expect(esc('a\\b\n\r\t\b\f\u0000\u001f/', 'json')).toBe('a\\\\b\\n\\r\\t\\b\\f\\u0000\\u001F/');
    expect(esc('🚀 é', 'json')).toBe('🚀 é');
    expect(esc('🚀 é', 'json', { asciiOnly: true })).toBe('\\uD83D\\uDE80 \\u00E9');
    expect(esc('x\uD800y', 'json')).toBe('x\\uD800y');
    expect(esc('hi', 'json', { wrap: true })).toBe('"hi"');
    for (const s of [SAMPLE, '\u0000\u0010\u001f', 'x\uDFFFy']) {
      expect(JSON.parse(`"${esc(s, 'json')}"`)).toBe(s);
      expect(JSON.parse(`"${esc(s, 'json', { asciiOnly: true })}"`)).toBe(s);
    }
  });

  it('unescapes with a strict parser', () => {
    expect(unesc('He said \\"hi\\"', 'json')).toBe('He said "hi"');
    expect(unesc('"a\\u00e9\\/\\n"', 'json')).toBe('aé/\n');
    expect(unesc('\\uD83D\\uDE80', 'json')).toBe('🚀');
    expect(unesc('  "quoted"  ', 'json')).toBe('quoted');
    expect(unesc('"ends with \\"', 'json')).toBe('"ends with "');
    expect(() => unesc('\\u12', 'json')).toThrow(/exactly 4 hex digits/);
    expect(() => unesc('\\uZZZZ', 'json')).toThrow(ToolInputError);
    expect(() => unesc("\\'", 'json')).toThrow(/not a JSON escape/);
    expect(() => unesc('\\x41', 'json')).toThrow(ToolInputError);
    expect(() => unesc('abc\\', 'json')).toThrow(/nothing to escape/);
  });

  it('matches JSON.parse on what it accepts', () => {
    const json = JSON.stringify(SAMPLE);
    expect(unesc(json, 'json')).toBe(JSON.parse(json));
  });
});

describe('JavaScript', () => {
  it('escapes for the chosen quote', () => {
    expect(esc(`it's "x" \`y\``, 'js')).toBe(`it\\'s "x" \`y\``);
    expect(esc(`it's "x"`, 'js', { quote: '"' })).toBe(`it's \\"x\\"`);
    expect(esc('`${a}` $b', 'js', { quote: '`' })).toBe('\\`\\${a}\\` $b');
    expect(esc('\0\0' + '1\v\u0001\u007f\u2028', 'js')).toBe('\\0\\x001\\v\\x01\\x7F\\u2028');
    expect(esc('x', 'js', { wrap: true, quote: '`' })).toBe('`x`');
  });

  it('escapes non-ASCII on request, with \\u{…} for astral characters', () => {
    expect(esc('é€🚀', 'js', { asciiOnly: true })).toBe('\\xE9\\u20AC\\uD83D\\uDE80');
    expect(esc('é€🚀', 'js', { asciiOnly: true, codePointEscapes: true })).toBe('\\xE9\\u20AC\\u{1F680}');
    expect(esc('\uD800', 'js')).toBe('\\uD800');
  });

  it('unescapes every JavaScript escape', () => {
    expect(unesc("it\\'s", 'js')).toBe("it's");
    expect(unesc("'it\\'s'", 'js')).toBe("it's");
    expect(unesc('`a\\${b}`', 'js')).toBe('a${b}');
    expect(unesc('\\x41\\u0042\\u{43}\\u{1F680}\\0\\b\\f\\n\\r\\t\\v', 'js')).toBe('ABC🚀\0\b\f\n\r\t\v');
    expect(unesc('a\\\nb\\\r\nc', 'js')).toBe('abc');
    expect(unesc('\\a\\q', 'js')).toBe('aq');
    expect(() => unesc('\\u{110000}', 'js')).toThrow(/U\+10FFFF/);
    expect(() => unesc('\\u{}', 'js')).toThrow(/Bad \\u\{…\}/);
    expect(() => unesc('\\u{12', 'js')).toThrow(ToolInputError);
    expect(() => unesc('\\u00G0', 'js')).toThrow(ToolInputError);
    expect(() => unesc('\\x4', 'js')).toThrow(/2 hex digits/);
    expect(() => unesc('\\101', 'js')).toThrow(/Octal escapes/);
    expect(() => unesc('\\01', 'js')).toThrow(/Octal escapes/);
  });
});

describe('C / Java', () => {
  it('escapes with octal for other control characters', () => {
    expect(esc('say "hi"\n\\', 'c')).toBe('say \\"hi\\"\\n\\\\');
    expect(esc("it's\u0007\u000b\u0000\u007f", 'c')).toBe("it's\\007\\013\\000\\177");
    expect(esc('é🚀', 'c', { asciiOnly: true, wrap: true })).toBe('"\\u00E9\\uD83D\\uDE80"');
  });

  it('unescapes C and Java escapes', () => {
    expect(unesc('\\a\\b\\f\\n\\r\\t\\v\\\\\\\'\\"\\?\\s', 'c')).toBe('\x07\b\f\n\r\t\v\\\'"? ');
    expect(unesc('\\101\\0\\7\\1234', 'c')).toBe('A\0\x07S4');
    expect(unesc('\\x41\\x1F680\\u00e9\\U0001F680', 'c')).toBe('A🚀é🚀');
    expect(() => unesc('\\400', 'c')).toThrow(/above \\377/);
    expect(() => unesc('\\xg', 'c')).toThrow(/hex digit/);
    expect(() => unesc('\\U00110000', 'c')).toThrow(/U\+10FFFF/);
    expect(() => unesc('\\q', 'c')).toThrow(/not a C or Java escape/);
  });
});

describe('SQL', () => {
  it('doubles quotes (standard) or uses backslashes (MySQL)', () => {
    expect(esc("O'Reilly", 'sql')).toBe("O''Reilly");
    expect(esc("O'Reilly", 'sql', { wrap: true })).toBe("'O''Reilly'");
    expect(esc('a\\b', 'sql')).toBe('a\\b');
    expect(esc('O\'R "x" \\ \0\n\r\x1a', 'sql', { mysql: true })).toBe('O\\\'R \\"x\\" \\\\ \\0\\n\\r\\Z');
  });

  it('unescapes and rejects lone quotes', () => {
    expect(unesc("O''Reilly", 'sql')).toBe("O'Reilly");
    expect(unesc("'O''Reilly'", 'sql')).toBe("O'Reilly");
    expect(unesc("''", 'sql')).toBe('');
    expect(unesc("a\\'b\\n\\%", 'sql', { mysql: true })).toBe("a'b\n\\%");
    expect(() => unesc("O'Reilly", 'sql')).toThrow(/isn’t doubled/);
    expect(() => unesc('a\\', 'sql', { mysql: true })).toThrow(ToolInputError);
  });
});

describe('POSIX shell', () => {
  it('wraps in single quotes', () => {
    expect(esc("it's", 'shell')).toBe("'it'\\''s'");
    expect(esc('', 'shell')).toBe("''");
    expect(esc('$HOME `x` "y"', 'shell')).toBe('\'$HOME `x` "y"\'');
  });

  it('parses shell words', () => {
    expect(unesc("'it'\\''s'", 'shell')).toBe("it's");
    expect(unesc('"a \\"b\\" \\$x \\\\ \\n"', 'shell')).toBe('a "b" $x \\ \\n');
    expect(unesc("a\\ b\\'c", 'shell')).toBe("a b'c");
    expect(unesc("$'a\\tb\\x41\\u00e9\\'\\101'", 'shell')).toBe("a\tbAé'A");
    expect(unesc("  'trimmed'\n", 'shell')).toBe('trimmed');
    expect(unesc('price=$', 'shell')).toBe('price=$');
    expect(() => unesc("'open", 'shell')).toThrow(/never closed/);
    expect(() => unesc('"open', 'shell')).toThrow(/never closed/);
    expect(() => unesc("$'open", 'shell')).toThrow(/never closed/);
    expect(() => unesc('two words', 'shell')).toThrow(/whitespace/);
    expect(() => unesc('a;b', 'shell')).toThrow(/shell syntax/);
    expect(() => unesc('$HOME', 'shell')).toThrow(/expanded/);
    expect(() => unesc('"${x}"', 'shell')).toThrow(/expanded/);
    expect(() => unesc('"`id`"', 'shell')).toThrow(/backtick/);
    expect(() => unesc('a\\', 'shell')).toThrow(/nothing to escape/);
  });
});

describe('PowerShell', () => {
  it('wraps in single quotes and doubles every single-quote character', () => {
    expect(esc("it's", 'powershell')).toBe("'it''s'");
    expect(esc('it’s $x', 'powershell')).toBe("'it’’s $x'");
  });

  it('unescapes single- and double-quoted strings', () => {
    expect(unesc("'it''s'", 'powershell')).toBe("it's");
    expect(unesc("it''s", 'powershell')).toBe("it's");
    expect(unesc('"a`tb`n`"q`" ""x"" `$y `u{1F680}"', 'powershell')).toBe('a\tb\n"q" "x" $y 🚀');
    expect(() => unesc("'it's'", 'powershell')).toThrow(/isn’t doubled/);
    expect(() => unesc('"$name"', 'powershell')).toThrow(/expanded/);
    expect(() => unesc('"a`"', 'powershell')).toThrow(/nothing to escape/);
  });
});

describe('Regular expression', () => {
  it('escapes metacharacters', () => {
    expect(esc('a.b*c+d?(e)[f]{g}|h^$\\/-', 'regex')).toBe('a\\.b\\*c\\+d\\?\\(e\\)\\[f\\]\\{g\\}\\|h\\^\\$\\\\\\/-');
    const literal = 'Price: $5.00 (approx.) [a-z]+?';
    const re = new RegExp(`^${esc(literal, 'regex')}$`, 'u');
    expect(re.test(literal)).toBe(true);
    expect(re.test('Price: $5x00 (approx.) [a-z]+?')).toBe(false);
  });

  it('unescapes plain literals only', () => {
    expect(unesc('a\\.b\\*\\/\\-\\@', 'regex')).toBe('a.b*/-@');
    expect(unesc('\\n\\t\\x41\\u0042\\u{1F680}\\cJ\\0', 'regex')).toBe('\n\tAB🚀\n\0');
    expect(() => unesc('a.b', 'regex')).toThrow(/Unescaped “\.”/);
    expect(() => unesc('\\d+', 'regex')).toThrow(/character class/);
    expect(() => unesc('\\1', 'regex')).toThrow(/back-reference/);
    expect(() => unesc('\\q', 'regex')).toThrow(/not a literal escape/);
  });
});

describe('CSV', () => {
  it('quotes only when needed (RFC 4180)', () => {
    expect(esc('plain', 'csv')).toBe('plain');
    expect(esc('plain', 'csv', { alwaysQuote: true })).toBe('"plain"');
    expect(esc('a,b', 'csv')).toBe('"a,b"');
    expect(esc('say "hi"', 'csv')).toBe('"say ""hi"""');
    expect(esc('two\nlines', 'csv')).toBe('"two\nlines"');
  });

  it('unescapes one field', () => {
    expect(unesc('"say ""hi"""', 'csv')).toBe('say "hi"');
    expect(unesc('"a,b"\n', 'csv')).toBe('a,b');
    expect(unesc('plain', 'csv')).toBe('plain');
    expect(unesc('""', 'csv')).toBe('');
    expect(() => unesc('"open', 'csv')).toThrow(/never closed/);
    expect(() => unesc('"a"b"', 'csv')).toThrow(/position 3 .*doubled/);
    expect(() => unesc('a,b', 'csv')).toThrow(/comma/);
    expect(() => unesc('a"b', 'csv')).toThrow(/must itself be quoted/);
  });
});

describe('XML / HTML', () => {
  it('escapes text and attributes', () => {
    expect(esc('<a href="x">Tom & Jerry\'s</a>', 'xml-text')).toBe('&lt;a href="x"&gt;Tom &amp; Jerry\'s&lt;/a&gt;');
    expect(esc('"x" \'y\' <&>\n\t\r', 'xml-attr')).toBe('&quot;x&quot; &#39;y&#39; &lt;&amp;&gt;&#10;&#9;&#13;');
    expect(esc('🚀', 'xml-text')).toBe('🚀');
    expect(() => esc('a\u0001', 'xml-text')).toThrow(/XML 1\.0/);
    expect(() => esc('a\uD800', 'xml-text')).toThrow(/lone surrogate/);
  });

  it('decodes entities and character references', () => {
    expect(unesc('&lt;b&gt; &amp;amp; &quot;&apos; &#65;&#x42;&#X1F680; &nbsp;&copy;&hellip;', 'xml-text')).toBe(
      '<b> &amp; "\' AB🚀 \u00A0©…',
    );
    expect(unesc('AT&T & co', 'xml-attr')).toBe('AT&T & co');
    expect(() => unesc('&bogus;', 'xml-text')).toThrow(/Unknown entity/);
    expect(() => unesc('&#0;', 'xml-text')).toThrow(/not a valid character/);
    expect(() => unesc('&#xD800;', 'xml-text')).toThrow(/not a valid character/);
    expect(() => unesc('&#x110000;', 'xml-text')).toThrow(/not a valid character/);
    expect(() => unesc('&#99999999999;', 'xml-text')).toThrow(/not a valid character/);
  });
});

describe('round trips', () => {
  const xmlSafe = SAMPLE.replaceAll('\u0001', '');
  const cases: Array<[EscapeMode, Partial<EscapeOptions>, string]> = [
    ['json', {}, SAMPLE],
    ['json', { asciiOnly: true, wrap: true }, SAMPLE],
    ['js', {}, SAMPLE],
    ['js', { quote: '"', asciiOnly: true, codePointEscapes: true, wrap: true }, SAMPLE],
    ['js', { quote: '`', wrap: true }, SAMPLE],
    ['c', {}, SAMPLE],
    ['c', { asciiOnly: true }, SAMPLE],
    ['sql', {}, SAMPLE],
    ['sql', { wrap: true }, SAMPLE],
    ['sql', { mysql: true }, SAMPLE.replace(/\\/g, '')],
    ['shell', {}, SAMPLE],
    ['powershell', {}, SAMPLE + ' ‘’'],
    ['regex', {}, SAMPLE.replace(/\\/g, '')],
    ['csv', {}, SAMPLE],
    ['csv', { alwaysQuote: true }, 'x'],
    ['xml-text', {}, xmlSafe],
    ['xml-attr', {}, xmlSafe],
  ];
  it.each(cases)('%s %j', (mode, options, text) => {
    expect(unesc(esc(text, mode, options), mode, options)).toBe(text);
  });
});

describe('stringEscaper', () => {
  it('has a label for every mode', () => {
    expect(MODES.map((m) => m.value)).toHaveLength(10);
  });

  it('runs the meta examples with the default options', () => {
    for (const ex of meta.examples ?? []) expect(stringEscaper(ex.input)).toContain(ex.expect);
  });

  it('rejects input over 1 MB', () => {
    expect(() => stringEscaper('a'.repeat(1_000_001))).toThrow(ToolInputError);
  });

  it('survives empty, huge and malformed input in every mode and direction', () => {
    const malformed = [
      '\\',
      '\\u',
      '\\u{',
      '\\x',
      '"\\"',
      "'",
      '"',
      '&#',
      '&#x;',
      '`',
      '$',
      "$'",
      '\\'.repeat(100_001),
      '"'.repeat(100_001),
      '&amp;'.repeat(100_000),
      "'".repeat(100_001),
    ];
    for (const { value: mode } of MODES) {
      for (const direction of ['escape', 'unescape'] as const) {
        expectRobust((s) => stringEscaper(s, { mode, direction }), { malformed });
      }
    }
    expectRobust((s) => stringEscaper(s, { mode: 'js', asciiOnly: true, codePointEscapes: true }));
    expectRobust((s) => stringEscaper(s, { mode: 'sql', direction: 'unescape', mysql: true }), { malformed });
  });
});
