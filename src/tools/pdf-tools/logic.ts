import { degrees, PDFDocument, StandardFonts } from 'pdf-lib';
import { ToolInputError } from '../types.ts';

const MAX_INPUT = 100_000;
const MAX_PDF_BYTES = 64 * 1024 * 1024;

export type PdfOperation = 'merge' | 'extract' | 'rotate' | 'compress';
export type RotationAngle = 90 | 180 | 270;

export interface PdfJobOptions {
  operation: PdfOperation;
  pageSpec?: string;
  rotation?: RotationAngle;
  stripMetadata?: boolean;
}

export interface PdfJobResult {
  summary: string;
  bytes: Uint8Array;
  pageCount: number;
}

/**
 * Parses a 1-based page range string such as "1-3, 5, 8-6" against `totalPages`.
 * Preserves the requested order and supports reverse ranges (e.g. "3-1").
 */
export function parsePageSelection(spec: string, totalPages: number): number[] {
  if (!Number.isInteger(totalPages) || totalPages < 1 || totalPages > 10_000) {
    throw new ToolInputError('Total pages must be between 1 and 10,000.');
  }
  const trimmed = spec.trim().toLowerCase();
  if (trimmed === '' || trimmed === 'all' || trimmed === '*') {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  if (trimmed === 'odd') {
    return Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => p % 2 === 1);
  }
  if (trimmed === 'even') {
    return Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => p % 2 === 0);
  }
  if (trimmed === 'reverse') {
    return Array.from({ length: totalPages }, (_, i) => totalPages - i);
  }

  const out: number[] = [];
  const parts = trimmed
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) throw new ToolInputError('Enter page numbers or ranges such as 1-3, 5.');

  for (const part of parts) {
    if (/^\d+$/.test(part)) {
      const p = Number(part);
      if (p < 1 || p > totalPages) {
        throw new ToolInputError(
          `Page ${p} is out of range (document has ${totalPages} page${totalPages === 1 ? '' : 's'}).`,
        );
      }
      out.push(p);
      continue;
    }
    const range = /^(\d+)\s*-\s*(\d+|end|last)$/.exec(part);
    if (!range) {
      throw new ToolInputError(`Invalid page range "${part}". Use numbers, ranges like 1-3, or all/odd/even/reverse.`);
    }
    const start = Number(range[1]);
    const end = range[2] === 'end' || range[2] === 'last' ? totalPages : Number(range[2]);
    if (start < 1 || start > totalPages || end < 1 || end > totalPages) {
      throw new ToolInputError(`Range ${part} is outside 1–${totalPages}.`);
    }
    const step = start <= end ? 1 : -1;
    for (let p = start; step > 0 ? p <= end : p >= end; p += step) {
      out.push(p);
      if (out.length > 10_000) throw new ToolInputError('Page selection exceeds 10,000 pages.');
    }
  }
  return out;
}

/**
 * Pure text planner for page range expressions (`pages: 10\nselect: 1-3, 5\nrotate: 90` or `10: 1-3, 5`).
 */
export function pdfTools(input: string): string {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large.');
  const trimmed = input.trim();
  if (trimmed === '') return '';

  let totalPages = 10;
  let selectSpec = trimmed;
  let rotateDeg: number | undefined;

  const shorthand = /^(\d+)\s*:\s*(.+)$/.exec(trimmed);
  if (shorthand && !trimmed.includes('\n')) {
    totalPages = Number(shorthand[1]);
    selectSpec = shorthand[2]!;
  } else if (/^(pages|select|rotate)\s*:/im.test(trimmed)) {
    const map: Record<string, string> = {};
    for (const line of trimmed.split(/\r?\n/)) {
      const m = /^([a-z]+)\s*:\s*(.*)$/i.exec(line.trim());
      if (!m) throw new ToolInputError(`Unrecognized line "${line}". Use pages:, select: and rotate:.`);
      map[m[1]!.toLowerCase()] = m[2]!.trim();
    }
    if (map.pages !== undefined) {
      if (!/^\d+$/.test(map.pages)) throw new ToolInputError('pages must be a whole number.');
      totalPages = Number(map.pages);
    }
    selectSpec = map.select ?? 'all';
    if (map.rotate !== undefined && map.rotate !== '') {
      const r = Number(map.rotate);
      if (r !== 0 && r !== 90 && r !== 180 && r !== 270) {
        throw new ToolInputError('rotate must be 0, 90, 180 or 270.');
      }
      if (r !== 0) rotateDeg = r;
    }
  }

  const pages = parsePageSelection(selectSpec, totalPages);
  const suffix = rotateDeg ? `, rotate ${rotateDeg} deg` : '';
  return `selected ${pages.length} of ${totalPages} page(s): ${pages.join(', ')}${suffix}`;
}

async function loadPdf(bytes: Uint8Array): Promise<PDFDocument> {
  if (bytes.length > MAX_PDF_BYTES) throw new ToolInputError('PDF file exceeds the 64 MB limit.');
  try {
    return await PDFDocument.load(bytes, { ignoreEncryption: false });
  } catch (error) {
    throw new ToolInputError(
      error instanceof Error ? `Could not read PDF: ${error.message}` : 'That file is not a valid or unencrypted PDF.',
    );
  }
}

function clearMetadata(doc: PDFDocument): void {
  doc.setTitle('');
  doc.setAuthor('');
  doc.setSubject('');
  doc.setKeywords([]);
  doc.setProducer('');
  doc.setCreator('');
}

/**
 * Runs merge, extract/split, rotate or compress over one or more PDF files.
 */
export async function processPdfFiles(files: Uint8Array[], options: PdfJobOptions): Promise<PdfJobResult> {
  if (files.length === 0) throw new ToolInputError('Choose at least one PDF file.');
  const totalBytes = files.reduce((sum, f) => sum + f.length, 0);
  if (totalBytes > MAX_PDF_BYTES) throw new ToolInputError('Combined PDF size exceeds 64 MB.');

  if (options.operation === 'merge') {
    const merged = await PDFDocument.create();
    for (const fileBytes of files) {
      const src = await loadPdf(fileBytes);
      const copied = await merged.copyPages(src, src.getPageIndices());
      for (const page of copied) merged.addPage(page);
    }
    if (options.stripMetadata) clearMetadata(merged);
    const outBytes = await merged.save({ useObjectStreams: true });
    const pageCount = merged.getPageCount();
    return {
      summary: `Merged ${files.length} file(s) into ${pageCount} page(s) (${outBytes.length.toLocaleString('en')} bytes).`,
      bytes: outBytes,
      pageCount,
    };
  }

  const src = await loadPdf(files[0]!);
  const srcCount = src.getPageCount();
  const selected = parsePageSelection(options.pageSpec ?? 'all', srcCount);

  if (options.operation === 'extract') {
    const outDoc = await PDFDocument.create();
    const indices = selected.map((p) => p - 1);
    const copied = await outDoc.copyPages(src, indices);
    for (const page of copied) outDoc.addPage(page);
    if (options.stripMetadata) clearMetadata(outDoc);
    const outBytes = await outDoc.save({ useObjectStreams: true });
    return {
      summary: `Extracted ${selected.length} of ${srcCount} page(s): [${selected.join(', ')}] (${outBytes.length.toLocaleString('en')} bytes).`,
      bytes: outBytes,
      pageCount: selected.length,
    };
  }

  if (options.operation === 'rotate') {
    const angle: RotationAngle = options.rotation ?? 90;
    if (angle !== 90 && angle !== 180 && angle !== 270) {
      throw new ToolInputError('Rotation angle must be 90, 180 or 270 degrees.');
    }
    const targetSet = new Set(selected);
    for (let i = 0; i < srcCount; i++) {
      if (targetSet.has(i + 1)) {
        const page = src.getPage(i);
        const current = page.getRotation().angle;
        page.setRotation(degrees((current + angle) % 360));
      }
    }
    if (options.stripMetadata) clearMetadata(src);
    const outBytes = await src.save({ useObjectStreams: true });
    return {
      summary: `Rotated ${targetSet.size} of ${srcCount} page(s) by ${angle}° (${outBytes.length.toLocaleString('en')} bytes).`,
      bytes: outBytes,
      pageCount: srcCount,
    };
  }

  // compress / optimize
  const rebuilt = await PDFDocument.create();
  const copied = await rebuilt.copyPages(src, src.getPageIndices());
  for (const page of copied) rebuilt.addPage(page);
  if (options.stripMetadata ?? true) clearMetadata(rebuilt);
  const outBytes = await rebuilt.save({ useObjectStreams: true, objectsPerTick: 100 });
  const before = files[0]!.length;
  const saved = before - outBytes.length;
  const deltaText =
    saved >= 0
      ? `reduced by ${saved.toLocaleString('en')} bytes`
      : `grew by ${Math.abs(saved).toLocaleString('en')} bytes`;
  return {
    summary: `Optimized ${srcCount} page(s) with object streams: ${before.toLocaleString('en')} → ${outBytes.length.toLocaleString('en')} bytes (${deltaText}).`,
    bytes: outBytes,
    pageCount: srcCount,
  };
}

/**
 * Builds a multi-page sample PDF for testing merge, split, rotate and compress.
 */
export async function createSamplePdf(pages = 4, label = 'Sample Document'): Promise<Uint8Array> {
  const count = Math.max(1, Math.min(20, Math.floor(pages)));
  const doc = await PDFDocument.create();
  doc.setTitle(label);
  doc.setAuthor('xt-tools');
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= count; i++) {
    const page = doc.addPage([420, 297]);
    page.drawText(`${label} — Page ${i} of ${count}`, {
      x: 36,
      y: 230,
      size: 18,
      font,
    });
    page.drawText('Processed locally in your browser with pdf-lib.', {
      x: 36,
      y: 195,
      size: 11,
      font,
    });
  }
  return await doc.save({ useObjectStreams: false });
}
