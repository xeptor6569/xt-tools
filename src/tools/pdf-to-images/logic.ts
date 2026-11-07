import { parsePageSelection } from '../pdf-tools/logic.ts';
import { ToolInputError } from '../types.ts';

const MAX_INPUT = 100_000;
const MAX_PDF_BYTES = 64 * 1024 * 1024;

export type PdfImageFormat = 'png' | 'jpeg' | 'webp';

export interface PdfRenderOptions {
  format?: PdfImageFormat;
  dpi?: number;
  quality?: number;
  pageSpec?: string;
}

export interface PdfPageInfo {
  pageNumber: number;
  widthPt: number;
  heightPt: number;
  widthPx: number;
  heightPx: number;
  rotation: number;
  textPreview: string;
}

export interface RenderedPdfPage extends PdfPageInfo {
  filename: string;
  mime: string;
  bytes?: Uint8Array;
}

export function mimeForPdfImage(format: PdfImageFormat): string {
  if (format === 'jpeg') return 'image/jpeg';
  if (format === 'webp') return 'image/webp';
  return 'image/png';
}

/**
 * Parses a page-render specification (`612 792 144 png` or key-value lines)
 * and calculates pixel dimensions at the target DPI (72 pt = 1 inch).
 */
export function pdfToImages(input: string): string {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large.');
  const trimmed = input.trim();
  if (trimmed === '') return '';

  let widthPt = 612;
  let heightPt = 792;
  let dpi = 144;
  let format: PdfImageFormat = 'png';
  let quality = 0.92;

  const tokens = trimmed.split(/\s+/);
  if (tokens.length >= 3 && !trimmed.includes(':') && tokens.slice(0, 3).every((t) => /^\d+(\.\d+)?$/.test(t))) {
    widthPt = Number(tokens[0]);
    heightPt = Number(tokens[1]);
    const third = Number(tokens[2]);
    dpi = third <= 8 ? Math.round(third * 72) : third;
    if (tokens[3]) {
      const f = tokens[3].toLowerCase();
      if (f === 'png' || f === 'jpeg' || f === 'jpg' || f === 'webp') {
        format = f === 'jpg' ? 'jpeg' : f;
      } else {
        throw new ToolInputError('Format must be png, jpeg or webp.');
      }
    }
    if (tokens[4]) quality = Number(tokens[4]);
  } else {
    for (const line of trimmed.split(/\r?\n/)) {
      const m = /^([a-z]+)\s*:\s*(.+)$/i.exec(line.trim());
      if (!m)
        throw new ToolInputError('Use "612 792 144 png" or key: value lines (width, height, dpi, format, quality).');
      const k = m[1]!.toLowerCase();
      const v = m[2]!.trim().toLowerCase();
      if (k === 'width') widthPt = Number(v);
      else if (k === 'height') heightPt = Number(v);
      else if (k === 'dpi') dpi = Number(v);
      else if (k === 'scale') dpi = Math.round(Number(v) * 72);
      else if (k === 'format') {
        if (v !== 'png' && v !== 'jpeg' && v !== 'jpg' && v !== 'webp') {
          throw new ToolInputError('format must be png, jpeg or webp.');
        }
        format = v === 'jpg' ? 'jpeg' : v;
      } else if (k === 'quality') quality = Number(v);
      else throw new ToolInputError(`Unknown field "${k}".`);
    }
  }

  if (!Number.isFinite(widthPt) || widthPt < 1 || widthPt > 14400) {
    throw new ToolInputError('Width must be between 1 and 14400 pt.');
  }
  if (!Number.isFinite(heightPt) || heightPt < 1 || heightPt > 14400) {
    throw new ToolInputError('Height must be between 1 and 14400 pt.');
  }
  if (!Number.isFinite(dpi) || dpi < 36 || dpi > 600) {
    throw new ToolInputError('DPI must be between 36 and 600.');
  }
  if (quality > 1 && quality <= 100) quality /= 100;
  if (!Number.isFinite(quality) || quality <= 0 || quality > 1) {
    throw new ToolInputError('Quality must be between 0.01 and 1.');
  }

  const scale = dpi / 72;
  const pxW = Math.max(1, Math.round(widthPt * scale));
  const pxH = Math.max(1, Math.round(heightPt * scale));
  return `${pxW}×${pxH} px (${dpi} DPI, ${scale.toFixed(2)}x) ${format} q=${quality.toFixed(2)}`;
}

async function loadPdfJs() {
  const g = globalThis as { pdfjsWorker?: unknown };
  if (!g.pdfjsWorker) {
    g.pdfjsWorker = await import('pdfjs-dist/build/pdf.worker.min.mjs');
  }
  return await import('pdfjs-dist/build/pdf.mjs');
}

/**
 * Uses pdf.js (`isEvalSupported: false`, local worker) to inspect and optionally rasterize PDF pages.
 */
export async function renderPdfToImages(
  pdfBytes: Uint8Array,
  options: PdfRenderOptions = {},
): Promise<{ summary: string; pages: RenderedPdfPage[] }> {
  if (pdfBytes.length > MAX_PDF_BYTES) throw new ToolInputError('PDF file exceeds the 64 MB limit.');
  const dpi = options.dpi ?? 144;
  if (!Number.isFinite(dpi) || dpi < 36 || dpi > 600) {
    throw new ToolInputError('DPI must be between 36 and 600.');
  }
  const format: PdfImageFormat = options.format ?? 'png';
  const quality = options.quality ?? 0.92;
  const scale = dpi / 72;
  const mime = mimeForPdfImage(format);
  const ext = format === 'jpeg' ? 'jpg' : format;

  const pdfjs = await loadPdfJs();
  let task;
  let doc;
  try {
    task = pdfjs.getDocument({
      data: new Uint8Array(pdfBytes),
      isEvalSupported: false,
      useSystemFonts: false,
      disableFontFace: true,
      verbosity: 0,
    });
    doc = await task.promise;
  } catch (error) {
    throw new ToolInputError(
      error instanceof Error ? `Could not parse PDF with pdf.js: ${error.message}` : 'Invalid PDF file.',
    );
  }

  try {
    const selected = parsePageSelection(options.pageSpec ?? 'all', doc.numPages);
    const pages: RenderedPdfPage[] = [];

    for (const pageNum of selected) {
      const page = await doc.getPage(pageNum);
      const baseVp = page.getViewport({ scale: 1 });
      const vp = page.getViewport({ scale });
      const widthPx = Math.max(1, Math.round(vp.width));
      const heightPx = Math.max(1, Math.round(vp.height));

      let textPreview = '';
      try {
        const textContent = await page.getTextContent();
        textPreview = textContent.items
          .map((item: Record<string, unknown>) => (typeof item.str === 'string' ? item.str : ''))
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 80);
      } catch {
        textPreview = '';
      }

      let bytes: Uint8Array | undefined;
      if (typeof OffscreenCanvas !== 'undefined') {
        const canvas = new OffscreenCanvas(widthPx, heightPx);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          await page.render({
            canvasContext: ctx as unknown as CanvasRenderingContext2D,
            canvas: canvas as unknown as HTMLCanvasElement,
            viewport: vp,
          }).promise;
          const blob = await canvas.convertToBlob({
            type: mime,
            ...(format === 'png' ? {} : { quality }),
          });
          bytes = new Uint8Array(await blob.arrayBuffer());
        }
      }

      pages.push({
        pageNumber: pageNum,
        widthPt: Math.round(baseVp.width),
        heightPt: Math.round(baseVp.height),
        widthPx,
        heightPx,
        rotation: page.rotate,
        textPreview,
        filename: `page-${pageNum}.${ext}`,
        mime,
        ...(bytes ? { bytes } : {}),
      });
    }

    const lines = pages.map(
      (p) =>
        `Page ${p.pageNumber}: ${p.widthPt}×${p.heightPt} pt → ${p.widthPx}×${p.heightPx} px (${p.filename}${p.bytes ? `, ${p.bytes.length.toLocaleString('en')} bytes` : ''})${p.textPreview ? ` "${p.textPreview}"` : ''}`,
    );
    return {
      summary: `Rendered ${pages.length} of ${doc.numPages} page(s) at ${dpi} DPI (${format.toUpperCase()}):\n${lines.join('\n')}`,
      pages,
    };
  } finally {
    await task.destroy();
  }
}
