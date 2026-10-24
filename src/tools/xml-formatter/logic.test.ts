import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { formatXml } from './logic.ts';
import meta from './meta.ts';

describe('formatXml', () => {
  it('pretty-prints with two spaces and keeps text-only elements on one line', () => {
    expect(formatXml('<a><b>1</b><c><d>x</d></c></a>')).toBe('<a>\n  <b>1</b>\n  <c>\n    <d>x</d>\n  </c>\n</a>');
  });

  it('supports four spaces, tabs and minify', () => {
    expect(formatXml('<a><b>1</b></a>', { indent: '4' })).toBe('<a>\n    <b>1</b>\n</a>');
    expect(formatXml('<a><b>1</b></a>', { indent: 'tab' })).toBe('<a>\n\t<b>1</b>\n</a>');
    expect(formatXml('<a>\n  <b>1</b>\n  <c  x="1"   y="2" />\n</a>\n', { indent: 'minify' })).toBe(
      '<a><b>1</b><c x="1" y="2"/></a>',
    );
  });

  it('re-indents already formatted XML idempotently', () => {
    const once = formatXml('<r>\n\n      <a>1</a>\n   <b/>\n</r>');
    expect(once).toBe('<r>\n  <a>1</a>\n  <b/>\n</r>');
    expect(formatXml(once)).toBe(once);
  });

  it('keeps the declaration, DOCTYPE, comments and processing instructions', () => {
    const input =
      '<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE note [<!ENTITY who "me > you"> <!-- a ] b > c -->]>' +
      '<!-- top --><?xml-stylesheet href="s.xsl"?><note><to>&who;</to><!-- inner < comment --><?pi a > b?></note>';
    expect(formatXml(input)).toBe(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<!DOCTYPE note [<!ENTITY who "me > you"> <!-- a ] b > c -->]>',
        '<!-- top -->',
        '<?xml-stylesheet href="s.xsl"?>',
        '<note>',
        '  <to>&who;</to>',
        '  <!-- inner < comment -->',
        '  <?pi a > b?>',
        '</note>',
      ].join('\n'),
    );
  });

  it('keeps CDATA, entities and attribute quoting exactly', () => {
    expect(formatXml('<a><b><![CDATA[x ]] y < z]]></b><c q=\'say "hi"\' r="1 > 0">&amp;&#x41;&lt;</c></a>')).toBe(
      '<a>\n  <b><![CDATA[x ]] y < z]]></b>\n  <c q=\'say "hi"\' r="1 > 0">&amp;&#x41;&lt;</c>\n</a>',
    );
  });

  it('keeps mixed content as written', () => {
    const input = '<doc><p>Some <b>bold</b>  and <i>italic</i> text.</p></doc>';
    expect(formatXml(input)).toBe('<doc>\n  <p>Some <b>bold</b>  and <i>italic</i> text.</p>\n</doc>');
  });

  it('respects xml:space="preserve"', () => {
    expect(formatXml('<a><pre xml:space="preserve">\n  <x>  </x>\n</pre></a>')).toBe(
      '<a>\n  <pre xml:space="preserve">\n  <x>  </x>\n</pre>\n</a>',
    );
  });

  it('handles namespaces and self-closing tags', () => {
    expect(formatXml('<ns:a xmlns:ns="urn:x"><ns:b ns:id="1"/><ns:c/></ns:a>')).toBe(
      '<ns:a xmlns:ns="urn:x">\n  <ns:b ns:id="1"/>\n  <ns:c/>\n</ns:a>',
    );
  });

  it('collapses empty elements only when asked', () => {
    expect(formatXml('<a><b></b><c>  </c></a>')).toBe('<a>\n  <b></b>\n  <c></c>\n</a>');
    expect(formatXml('<a><b></b><c x="1">\n</c></a>', { collapseEmpty: true })).toBe('<a>\n  <b/>\n  <c x="1"/>\n</a>');
  });

  it('wraps attributes onto their own lines past the limit', () => {
    const input = '<root><item id="1" name="long name here" kind="x"/><short a="1" b="2">t</short></root>';
    expect(formatXml(input, { wrapAttributes: 30 })).toBe(
      [
        '<root>',
        '  <item',
        '    id="1"',
        '    name="long name here"',
        '    kind="x"/>',
        '  <short a="1" b="2">t</short>',
        '</root>',
      ].join('\n'),
    );
  });

  it('drops a BOM and normalises CRLF', () => {
    expect(formatXml('\uFEFF<a>\r\n<b>1</b>\r\n</a>')).toBe('<a>\n  <b>1</b>\n</a>');
  });

  it('returns nothing for empty input', () => {
    expect(formatXml('')).toBe('');
    expect(formatXml(' \n\t')).toBe('');
  });

  it('reports errors with line and column', () => {
    expect(() => formatXml('<a>\n<b></a>')).toThrow(/line 2, column \d+/);
    expect(() => formatXml('<a x=1/>')).toThrow(/without value/);
    expect(() => formatXml('<a><!-- open')).toThrow(/comment is never closed/);
    expect(() => formatXml('<a><![CDATA[x</a>')).toThrow(ToolInputError);
    expect(() => formatXml('<a>1 < 2</a>')).toThrow(/&lt;/);
    expect(() => formatXml('<a/><b/>')).toThrow(ToolInputError);
    expect(() => formatXml('hello')).toThrow(/line 1, column 1/);
    expect(() => formatXml('<a><b><c>')).toThrow(/<c> is never closed/);
    expect(() => formatXml('<a/><!DOCTYPE a>')).toThrow(/DOCTYPE/);
    expect(() => formatXml('<a x="1>')).toThrow(ToolInputError);
  });

  it('handles 10 000 levels of nesting without recursion', () => {
    const deep = '<a>'.repeat(10_000) + 'x' + '</a>'.repeat(10_000);
    expect(formatXml(deep, { indent: 'minify' })).toBe(deep);
    // Pretty-printing that deep would need ~200 MB of indentation, so it is refused cleanly.
    expect(() => formatXml(deep)).toThrow(/larger than 16 MB/);
    const ok = '<a>'.repeat(1000) + '</a>'.repeat(1000);
    expect(formatXml(ok, { indent: 'tab' }).split('\n')).toHaveLength(1999);
  });

  it('formats a large document quickly', () => {
    const big = '<r>' + '<item id="1">text &amp; more</item><!-- c -->'.repeat(30_000) + '</r>';
    const start = performance.now();
    expect(formatXml(big).split('\n')).toHaveLength(60_002);
    expect(performance.now() - start).toBeLessThan(2000);
  });

  it('runs the meta examples', () => {
    for (const { input, expect: expected } of meta.examples ?? []) expect(formatXml(input)).toContain(expected);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(formatXml, {
      malformed: [
        '<'.repeat(100_000),
        '<a ' + 'x'.repeat(100_000),
        '<!DOCTYPE [[[[',
        '<a>'.repeat(100_000),
        '</a>'.repeat(100_000),
        '<?xml',
        '<a x="1" x="2"/>',
        '<!x>',
        '<a>\u{1F680} \uD800 <script>alert(1)</script></a>',
      ],
    });
  });
});
