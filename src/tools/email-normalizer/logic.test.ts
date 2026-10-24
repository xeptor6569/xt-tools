import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { PROVIDERS } from './data.ts';
import { DEFAULT_OPTIONS, domainToAscii, emailNormalizer, splitEntries, type EmailOptions } from './logic.ts';
import meta from './meta.ts';

const norm = (input: string, options: Partial<EmailOptions> = {}) =>
  emailNormalizer(input, { ...DEFAULT_OPTIONS, ...options }).addresses;
const one = (input: string, options: Partial<EmailOptions> = {}) => norm(input, options)[0];
const row = (input: string) => emailNormalizer(input).rows[0]!;

describe('splitEntries', () => {
  it('splits on new lines, commas and semicolons', () => {
    expect(splitEntries('a@x.com\n b@x.com , c@x.com;d@x.com\r\n\n')).toEqual([
      { line: 1, text: 'a@x.com' },
      { line: 2, text: 'b@x.com' },
      { line: 2, text: 'c@x.com' },
      { line: 2, text: 'd@x.com' },
    ]);
  });

  it('keeps commas inside quoted display names', () => {
    expect(splitEntries('"Doe, John" <j@x.com>, k@x.com').map((e) => e.text)).toEqual([
      '"Doe, John" <j@x.com>',
      'k@x.com',
    ]);
  });
});

describe('domainToAscii', () => {
  it('converts IDNs to punycode (RFC 3492 / UTS #46)', () => {
    expect(domainToAscii('bücher.de')).toBe('xn--bcher-kva.de');
    expect(domainToAscii('MÜNCHEN.de')).toBe('xn--mnchen-3ya.de');
    expect(domainToAscii('例え.テスト')).toBe('xn--r8jz45g.xn--zckzah');
    expect(domainToAscii('Example.COM')).toBe('example.com');
  });
});

describe('emailNormalizer', () => {
  it('applies the Gmail rules', () => {
    expect(one('John.Doe+news@GoogleMail.com')).toBe('johndoe@gmail.com');
    expect(one('j.o.h.n@gmail.com')).toBe('john@gmail.com');
    expect(row('John.Doe+news@GoogleMail.com').notes).toEqual([
      'domain lowercased',
      'lowercased',
      '“+news” tag removed (Gmail)',
      'dots removed (Gmail ignores them)',
      'googlemail.com → gmail.com',
    ]);
  });

  it('applies the other provider rules', () => {
    expect(one('Foo+bar@Outlook.com')).toBe('foo@outlook.com');
    expect(one('foo.bar+x@hotmail.co.uk')).toBe('foo.bar@hotmail.co.uk');
    expect(one('user-shopping@yahoo.com')).toBe('user@yahoo.com');
    expect(one('user+shopping@yahoo.com')).toBe('user+shopping@yahoo.com');
    expect(one('a.b+c@icloud.com')).toBe('a.b@icloud.com');
    expect(one('a+c@me.com')).toBe('a@me.com');
    expect(one('a+c@pm.me')).toBe('a@pm.me');
    expect(one('a+c@fastmail.com')).toBe('a@fastmail.com');
  });

  it('leaves other domains alone unless asked', () => {
    expect(one('x.y+z@example.com')).toBe('x.y+z@example.com');
    expect(one('x.y+z@example.com', { stripAllTags: true })).toBe('x.y@example.com');
    expect(one('x-y@example.com', { stripAllTags: true })).toBe('x-y@example.com');
    expect(one('a.b+c@gmail.com', { providerRules: false })).toBe('a.b+c@gmail.com');
    expect(one('a.b+c@googlemail.com', { providerRules: false })).toBe('a.b+c@googlemail.com');
  });

  it('keeps a tag that is the whole local part', () => {
    expect(one('+tag@gmail.com')).toBe('+tag@gmail.com');
  });

  it('lowercases the domain always and the local part optionally', () => {
    expect(one('John@Example.COM')).toBe('john@example.com');
    expect(one('John@Example.COM', { lowercaseLocal: false })).toBe('John@example.com');
  });

  it('converts IDN domains and keeps Unicode local parts', () => {
    expect(one('Jörg@Bücher.de')).toBe('jörg@xn--bcher-kva.de');
    expect(row('user@bücher.de').notes).toContain('domain converted to ASCII (punycode)');
  });

  it('strips display names, mailto: and trailing dots', () => {
    expect(one('Jane Doe <Jane@Example.com>')).toBe('jane@example.com');
    expect(one('<a@example.com>')).toBe('a@example.com');
    expect(one('mailto:a@example.com?subject=hi')).toBe('a@example.com');
    expect(one('a@example.com.')).toBe('a@example.com');
    expect(row('Jane Doe <Jane@Example.com>').notes).toContain('display name removed');
  });

  it('removes duplicates in first-seen order', () => {
    const r = emailNormalizer('b@x.com\nA@X.com, b@x.com; a@x.com\nj.d@gmail.com\njd+1@googlemail.com');
    expect(r.addresses).toEqual(['b@x.com', 'a@x.com', 'jd@gmail.com']);
    expect(r.duplicates).toBe(3);
    expect(r.rows[2]).toMatchObject({ status: 'duplicate', notes: ['duplicate of line 1'] });
    expect(norm('a@x.com\na@x.com', { dedupe: false })).toEqual(['a@x.com', 'a@x.com']);
  });

  it('reports invalid lines without dropping the valid ones', () => {
    const bad = [
      'hello',
      'a@b',
      '@example.com',
      'a@',
      'a..b@example.com',
      '.a@example.com',
      'a b@example.com',
      'a@exa mple.com',
      'a@b@example.com',
      '"quoted"@example.com',
      'a@-x.com',
      'a@x.c',
      'a@1.2.3.4',
      'a@example.com/path',
      'a@ex_ample.com',
      `${'a'.repeat(65)}@example.com`,
    ];
    const r = emailNormalizer(['ok@example.com', ...bad].join('\n'));
    expect(r.addresses).toEqual(['ok@example.com']);
    expect(r.invalid).toBe(bad.length);
    for (const row of r.rows.slice(1)) {
      expect(row.status, row.original).toBe('invalid');
      expect(row.notes[0]).toMatch(/^invalid: /);
    }
    expect(emailNormalizer('hello').rows[0]!.notes).toEqual(['invalid: no @']);
  });

  it('counts changed addresses', () => {
    expect(emailNormalizer('a@x.com\nB@x.com').changed).toBe(1);
  });

  it('returns nothing for empty input', () => {
    expect(emailNormalizer('  \n ')).toEqual({ addresses: [], rows: [], invalid: 0, duplicates: 0, changed: 0 });
  });

  it('rejects input over 1 MB', () => {
    expect(() => emailNormalizer('a'.repeat(1_000_001))).toThrow(ToolInputError);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust((s) => emailNormalizer(s), {
      malformed: [
        'a@\uD800.com',
        '\uDFFF@x.com',
        '<'.repeat(100_000),
        'a@'.repeat(100_000),
        '"'.repeat(1000),
        ',;'.repeat(100_000),
        `x@${'a.'.repeat(200)}com`,
        'x@[127.0.0.1]',
        'x@xn--.com',
        'x@xn--zz.com',
      ],
    });
    expectRobust((s) => emailNormalizer(s, { ...DEFAULT_OPTIONS, stripAllTags: true, dedupe: false }));
    expectRobust((s) => emailNormalizer(`${s}@example.com`));
    expectRobust((s) => emailNormalizer(`x@${s}.com`));
  });

  it('handles 1 MB of addresses quickly', () => {
    const input = Array.from({ length: 40_000 }, (_, i) => `User.${i}+x@GMail.com`).join('\n');
    const start = performance.now();
    const r = emailNormalizer(input);
    expect(r.addresses).toHaveLength(40_000);
    expect(performance.now() - start).toBeLessThan(2000);
  });
});

describe('data and meta', () => {
  it('lists each provider domain once, in lower case', () => {
    const domains = PROVIDERS.flatMap((p) => p.domains);
    expect(new Set(domains).size).toBe(domains.length);
    for (const d of domains) expect(d).toBe(d.toLowerCase());
  });

  it('examples produce the expected output', () => {
    for (const ex of meta.examples ?? []) expect(norm(ex.input).join('\n')).toContain(ex.expect);
  });
});
