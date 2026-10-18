import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { htmlDocument, markdownStats, markdownToHtml } from './logic.ts';

describe('markdownToHtml', () => {
  it('renders CommonMark and GitHub extensions', () => {
    expect(markdownToHtml('# Title\n\nSome **bold** and `code`.')).toBe(
      '<h1>Title</h1>\n<p>Some <strong>bold</strong> and <code>code</code>.</p>\n',
    );
    expect(markdownToHtml('| a | b |\n|---|---|\n| 1 | 2 |')).toContain('<table>');
    expect(markdownToHtml('- [x] done')).toContain('<input checked="" disabled="" type="checkbox">');
    expect(markdownToHtml('~~gone~~')).toBe('<p><del>gone</del></p>\n');
  });

  it('does not sanitize by itself (the preview does)', () => {
    expect(markdownToHtml('<script>alert(1)</script>')).toContain('<script>');
  });

  it('counts words, headings and links', () => {
    expect(markdownStats('# A\n\nSee [x](y) and [z](w).')).toEqual({ words: 7, headings: 1, links: 2 });
  });

  it('builds a standalone document with a strict CSP', () => {
    const doc = htmlDocument('Notes <1>', '<p>hi</p>', 'body{color:red}</style><script>');
    expect(doc).toContain("default-src 'none'; style-src 'unsafe-inline'; img-src data: blob:");
    expect(doc).toContain('<style>body{color:red}><script></style>');
    expect(doc).toContain('<title>Notes &lt;1></title>');
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(markdownToHtml, {
      timeLimitMs: 15_000,
      malformed: ['['.repeat(10_000), '*'.repeat(10_000), '> '.repeat(5000)],
    });
  });
});
