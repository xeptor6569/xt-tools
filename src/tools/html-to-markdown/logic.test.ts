import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { htmlToMarkdown } from './logic.ts';

describe('htmlToMarkdown', () => {
  it('converts common elements', () => {
    expect(
      htmlToMarkdown(
        '<h1>Title</h1><p>Some <strong>bold</strong>, <em>italic</em> and <a href="https://x.test/">a link</a>.</p>',
      ),
    ).toBe('# Title\n\nSome **bold**, _italic_ and [a link](https://x.test/).');
    expect(htmlToMarkdown('<ul><li>one</li><li>two</li></ul>')).toBe('-   one\n-   two');
    expect(htmlToMarkdown('<pre><code class="language-js">let a = 1;</code></pre>')).toBe('```js\nlet a = 1;\n```');
  });

  it('supports GitHub-flavoured tables, strikethrough and task lists', () => {
    expect(
      htmlToMarkdown(
        '<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>',
      ),
    ).toBe('| A | B |\n| --- | --- |\n| 1 | 2 |');
    expect(htmlToMarkdown('<del>gone</del>')).toBe('~gone~');
    expect(htmlToMarkdown('<ul><li><input type="checkbox" checked>done</li></ul>')).toBe('-   [x] done');
  });

  it('honours options', () => {
    expect(htmlToMarkdown('<h2>Hi</h2>', { headingStyle: 'setext' })).toBe('Hi\n--');
    expect(htmlToMarkdown('<ul><li>a</li></ul>', { bulletListMarker: '*' })).toBe('*   a');
  });

  it('drops scripts, styles and forms', () => {
    expect(htmlToMarkdown('<p>ok</p><script>alert(1)</script><style>p{}</style><form><input></form>')).toBe('ok');
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(htmlToMarkdown, {
      timeLimitMs: 20_000,
      malformed: ['<div><span>', '<<<>>>', '<table><tr><td>'.repeat(200)],
    });
  });
});
