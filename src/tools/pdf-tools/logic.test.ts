import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { createSamplePdf, parsePageSelection, pdfTools, processPdfFiles } from './logic.ts';

describe('pdfTools', () => {
  it('parses forward, reverse, odd, even and all page selections', () => {
    expect(parsePageSelection('1-3, 6, 8-7', 8)).toEqual([1, 2, 3, 6, 8, 7]);
    expect(parsePageSelection('odd', 5)).toEqual([1, 3, 5]);
    expect(parsePageSelection('even', 5)).toEqual([2, 4]);
    expect(parsePageSelection('reverse', 4)).toEqual([4, 3, 2, 1]);
    expect(pdfTools('pages: 8\nselect: 1-3, 6, 8-7\nrotate: 90')).toBe(
      'selected 6 of 8 page(s): 1, 2, 3, 6, 8, 7, rotate 90 deg',
    );
  });

  it('merges, extracts, rotates and compresses real PDFs', async () => {
    const pdfA = await createSamplePdf(3, 'Doc A');
    const pdfB = await createSamplePdf(2, 'Doc B');

    const merged = await processPdfFiles([pdfA, pdfB], { operation: 'merge', stripMetadata: true });
    expect(merged.pageCount).toBe(5);

    const extracted = await processPdfFiles([merged.bytes], { operation: 'extract', pageSpec: '2-4' });
    expect(extracted.pageCount).toBe(3);

    const rotated = await processPdfFiles([extracted.bytes], {
      operation: 'rotate',
      pageSpec: '1, 3',
      rotation: 90,
    });
    const doc = await PDFDocument.load(rotated.bytes);
    expect(doc.getPage(0).getRotation().angle).toBe(90);
    expect(doc.getPage(1).getRotation().angle).toBe(0);
    expect(doc.getPage(2).getRotation().angle).toBe(90);

    const compressed = await processPdfFiles([pdfA], { operation: 'compress', stripMetadata: true });
    expect(compressed.pageCount).toBe(3);
    expect(compressed.bytes.length).toBeGreaterThan(100);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust((input) => pdfTools(input), { timeLimitMs: 5000 });
  });
});
