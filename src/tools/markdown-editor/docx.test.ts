import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { markdownToDocx } from './docx.ts';

function unzip(data: Uint8Array): Map<string, string> {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const files = new Map<string, string>();
  let offset = 0;
  const decoder = new TextDecoder();
  while (offset + 30 <= data.length && view.getUint32(offset, true) === 0x04034b50) {
    const method = view.getUint16(offset + 8, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const size = view.getUint32(offset + 22, true);
    const nameStart = offset + 30;
    const name = decoder.decode(data.subarray(nameStart, nameStart + nameLength));
    const start = nameStart + nameLength + extraLength;
    expect(method, name).toBe(0);
    files.set(name, decoder.decode(data.subarray(start, start + size)));
    offset = start + size;
  }
  return files;
}

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

describe('markdownToDocx', () => {
  const source = [
    '# Notes',
    '',
    'Write **bold** and *italic* and `code` and ~~gone~~.',
    '',
    '- [x] Done',
    '- [ ] Later',
    '',
    '1. One',
    '2. Two',
    '   - nested',
    '',
    '> A quote with **bold**',
    '',
    '```js',
    'const a = 1;',
    '```',
    '',
    '| Feature | Works |',
    '| :---: | ---: |',
    '| **Tables** | [Yes](https://example.com/docs?a=1&b=2) |',
    '',
    '![alt](https://example.com/pixel.png)',
    '',
    '[click](javascript:alert(1))',
    '',
    `![dot](data:image/png;base64,${PNG})`,
  ].join('\n');

  const files = unzip(markdownToDocx(source));
  const document = files.get('word/document.xml') ?? '';
  const rels = files.get('word/_rels/document.xml.rels') ?? '';
  const styles = files.get('word/styles.xml') ?? '';
  const numbering = files.get('word/numbering.xml') ?? '';

  it('is a zip Word can open', () => {
    expect(files.has('[Content_Types].xml')).toBe(true);
    expect(files.has('word/styles.xml')).toBe(true);
    expect(files.has('word/numbering.xml')).toBe(true);
    expect(document).toContain('<w:document');
    expect(document).toContain('<w:sectPr>');
  });

  it('keeps headings, emphasis, code and links', () => {
    expect(document).toContain('w:val="Heading1"');
    expect(document).toContain('>Notes</w:t>');
    expect(document).toContain('<w:b/>');
    expect(document).toContain('>bold</w:t>');
    expect(document).toContain('<w:i/>');
    expect(document).toContain('<w:strike/>');
    expect(document).toContain('Consolas');
    expect(document).toContain('>code</w:t>');
    expect(document).toContain('w:val="Hyperlink"');
    expect(rels).toContain('https://example.com/docs?a=1&amp;b=2');
    expect(rels).not.toContain('javascript:');
    expect(styles).toContain('w:val="1D4ED8"');
  });

  it('keeps lists, quotes and fenced code', () => {
    expect(document).toContain('☑');
    expect(document).toContain('☐');
    expect(document).toContain('<w:numId w:val="1"/>');
    expect(numbering).toContain('w:val="bullet"');
    expect(numbering).toContain('w:val="decimal"');
    expect(document).toContain('w:val="Quote"');
    expect(document).toContain('w:val="CodeBlock"');
    expect(document).toContain('const a = 1;');
  });

  it('keeps table borders, a shaded header and cell alignment', () => {
    expect(document).toContain('<w:tbl>');
    expect(document).toContain('<w:tblHeader/>');
    expect(document).toContain('w:fill="F3F4F6"');
    expect(document).toContain('w:color="D1D5DB"');
    expect(document).toContain('<w:jc w:val="center"/>');
    expect(document).toContain('<w:jc w:val="right"/>');
    expect(document).toContain('>Feature</w:t>');
    expect(document).toContain('>Tables</w:t>');
  });

  it('embeds data images and does not point Word at remote ones', () => {
    expect(rels).not.toContain('example.com/pixel.png');
    expect(document).toContain('>alt</w:t>');
    expect(rels).toContain('media/image1.png');
    expect(files.get('word/media/image1.png')).toContain('PNG');
  });

  it('rejects input over 5 MB', () => {
    expect(() => markdownToDocx('a'.repeat(5_000_001))).toThrow(ToolInputError);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(markdownToDocx, { malformed: ['['.repeat(2000), '|'.repeat(2000), '> '.repeat(500)] });
  });
});
