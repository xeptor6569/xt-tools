import { describe, expect, it } from 'vitest';
import { expectRobustAsync } from '../../../tests/helpers/expect-robust.ts';
import { createSamplePdfWithImages, extractImagesFromPdf, pdfImageExtractor } from './logic.ts';

describe('pdfImageExtractor', () => {
  it('parses an Image XObject dictionary', async () => {
    const dict =
      '<< /Type /XObject /Subtype /Image /Width 640 /Height 480 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode >>';
    expect(await pdfImageExtractor(dict)).toContain('#1: 640×480 DeviceRGB [DCTDecode] → image-1.jpg');
  });

  it('extracts embedded images from a real PDF into valid PNG files', async () => {
    const pdfBytes = await createSamplePdfWithImages();
    const res = await extractImagesFromPdf(pdfBytes);
    expect(res.images).toHaveLength(2);
    expect(res.images[0]!.width).toBe(24);
    expect(res.images[0]!.height).toBe(16);
    expect(res.images[0]!.format).toBe('png');
    expect(Array.from(res.images[0]!.bytes.slice(0, 4))).toEqual([137, 80, 78, 71]);
    expect(res.images[1]!.width).toBe(16);
    expect(res.images[1]!.height).toBe(16);
  });

  it('survives empty, huge and malformed input', async () => {
    await expectRobustAsync((input) => pdfImageExtractor(input), { timeLimitMs: 5000 });
  });
});
