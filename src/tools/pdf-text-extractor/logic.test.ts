import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { createSamplePdf } from '../pdf-tools/logic.ts';
import meta from './meta.ts';
import { extractPdfText, layoutTextRuns, pdfTextExtractor, textRunsFromItems, type PdfTextRun } from './logic.ts';

function run(partial: Partial<PdfTextRun> & Pick<PdfTextRun, 'str'>): PdfTextRun {
  return {
    x: 0,
    y: 0,
    width: 10,
    height: 12,
    hasEOL: false,
    ...partial,
  };
}

describe('pdfTextExtractor', () => {
  it('describes a page selection before a file is loaded', () => {
    expect(pdfTextExtractor('')).toBe('');
    expect(pdfTextExtractor('   ')).toBe('');
    expect(pdfTextExtractor('all')).toBe('Will read every page.');
    expect(pdfTextExtractor('*')).toBe('Will read every page.');
    expect(pdfTextExtractor('odd')).toBe('Will read the odd pages.');
    expect(pdfTextExtractor('even')).toBe('Will read the even pages.');
    expect(pdfTextExtractor('reverse')).toBe('Will read the pages from last to first.');
    expect(pdfTextExtractor('1-2, 4')).toBe('Will read pages 1, 2, 4.');
    expect(pdfTextExtractor('1-20')).toBe('Will read 20 pages, from 1 to 20.');
    for (const example of meta.examples ?? []) {
      expect(pdfTextExtractor(example.input)).toContain(example.expect);
    }
  });

  it('rejects a selection that is not a page range', () => {
    expect(() => pdfTextExtractor('hello')).toThrow(/page/i);
    expect(() => pdfTextExtractor('0')).toThrow(Error);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(pdfTextExtractor);
  });
});

describe('layoutTextRuns', () => {
  it('joins glyphs on one baseline and keeps a later line below', () => {
    expect(
      layoutTextRuns([
        run({ str: 'world', x: 50, y: 100, width: 30 }),
        run({ str: 'Hello', x: 10, y: 100, width: 30 }),
        run({ str: 'Next', x: 10, y: 70, width: 24, height: 11 }),
      ]),
    ).toBe('Hello world\nNext');
  });

  it('does not insert a space between kerning pairs', () => {
    expect(
      layoutTextRuns([run({ str: 'H', x: 10, y: 100, width: 8 }), run({ str: 'i', x: 18.2, y: 100, width: 4 })]),
    ).toBe('Hi');
  });

  it('breaks a line when a run is marked as the end of a line', () => {
    expect(
      layoutTextRuns([
        run({ str: 'A', x: 10, y: 100, width: 10, hasEOL: true }),
        run({ str: 'B', x: 30, y: 99, width: 10 }),
      ]),
    ).toBe('A\nB');
  });

  it('reads text items and skips markers that have no string', () => {
    const runs = textRunsFromItems([
      { type: 'beginMarkedContent' },
      { str: '', transform: [1, 0, 0, 1, 0, 0] },
      { str: 'Hi', transform: new Float32Array([1, 0, 0, 1, 12, 40]), width: 12, height: 12 },
    ]);
    expect(runs).toEqual([run({ str: 'Hi', x: 12, y: 40, width: 12 })]);
    expect(layoutTextRuns([])).toBe('');
  });
});

describe('extractPdfText', () => {
  it('reads each page of a text PDF and a single requested page', async () => {
    const bytes = await createSamplePdf(2, 'PDF text sample');
    const all = await extractPdfText(bytes, { pageSpec: 'all' });
    expect(all.pageCount).toBe(2);
    expect(all.selected).toBe(2);
    expect(all.emptyPages).toBe(0);
    expect(all.text).toContain('Page 1\nPDF text sample — Page 1 of 2');
    expect(all.text).toContain('Processed locally in your browser with pdf-lib.');
    expect(all.text).toContain('Page 2\nPDF text sample — Page 2 of 2');

    const second = await extractPdfText(bytes, { pageSpec: '2' });
    expect(second.selected).toBe(1);
    expect(second.text).toContain('PDF text sample — Page 2 of 2');
    expect(second.text).not.toContain('Page 1 of 2');
  });

  it('says when a page has no text layer', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([420, 297]);
    const blank = await doc.save();
    const result = await extractPdfText(blank, { pageSpec: '1' });
    expect(result.emptyPages).toBe(1);
    expect(result.text).toContain('No text layer on this page');
  });

  it('rejects an empty or damaged file', async () => {
    await expect(extractPdfText(new Uint8Array())).rejects.toThrow(/Choose a PDF/);
    await expect(extractPdfText(new Uint8Array([1, 2, 3, 4]))).rejects.toThrow(/Could not read this PDF/);
  });
});
