import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { createSamplePdf } from '../pdf-tools/logic.ts';
import { pdfToImages, renderPdfToImages } from './logic.ts';

describe('pdfToImages', () => {
  it('computes output pixel dimensions from points and DPI', () => {
    expect(pdfToImages('612 792 144 png 0.92')).toBe('1224×1584 px (144 DPI, 2.00x) png q=0.92');
    expect(pdfToImages('width: 595\nheight: 842\ndpi: 72\nformat: webp')).toBe(
      '595×842 px (72 DPI, 1.00x) webp q=0.92',
    );
  });

  it('parses and measures PDF pages with pdf.js (isEvalSupported: false)', async () => {
    const pdfBytes = await createSamplePdf(2, 'Raster Test');
    const result = await renderPdfToImages(pdfBytes, { dpi: 144, format: 'png', pageSpec: '1-2' });
    expect(result.pages).toHaveLength(2);
    expect(result.pages[0]!.widthPt).toBe(420);
    expect(result.pages[0]!.heightPt).toBe(297);
    expect(result.pages[0]!.widthPx).toBe(840);
    expect(result.pages[0]!.heightPx).toBe(594);
    expect(result.pages[0]!.textPreview).toContain('Raster Test');
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust((input) => pdfToImages(input), { timeLimitMs: 5000 });
  });
});
