import { parsePageSelection } from '../pdf-tools/logic.ts';
import { ToolInputError } from '../types.ts';

const MAX_SPEC = 10_000;
const MAX_PDF_BYTES = 64 * 1024 * 1024;
const MAX_TEXT_CHARS = 2_000_000;
const PREVIEW_PAGE_COUNT = 10_000;

export { MAX_PDF_BYTES };

export interface PdfTextRun {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  hasEOL: boolean;
}

export interface PdfTextPage {
  pageNumber: number;
  text: string;
  hasText: boolean;
}

export interface PdfTextResult {
  text: string;
  pageCount: number;
  selected: number;
  emptyPages: number;
}

const EMPTY_PAGE = 'No text layer on this page. A scan or a picture of a page has nothing to extract.';

/**
 * Describes which pages a selection would read, before a PDF is loaded.
 * `all`, `odd`, `even` and `reverse` stay as words. A numeric range is checked
 * against a 10,000-page document so the field can be tried on its own.
 */
export function pdfTextExtractor(input: string): string {
  if (input.length > MAX_SPEC) throw new ToolInputError('Page selection is too long.');
  const spec = input.trim();
  if (spec === '') return '';
  const key = spec.toLowerCase();
  if (key === 'all' || key === '*') return 'Will read every page.';
  if (key === 'odd') return 'Will read the odd pages.';
  if (key === 'even') return 'Will read the even pages.';
  if (key === 'reverse') return 'Will read the pages from last to first.';
  const pages = parsePageSelection(spec, PREVIEW_PAGE_COUNT);
  if (pages.length > 12) {
    return `Will read ${pages.length} pages, from ${pages[0]} to ${pages[pages.length - 1]}.`;
  }
  return `Will read pages ${pages.join(', ')}.`;
}

function numberAt(value: unknown, index: number): number {
  if (typeof value === 'number') return index === 0 ? value : 0;
  if (Array.isArray(value) || ArrayBuffer.isView(value)) {
    const n = (value as ArrayLike<unknown>)[index];
    return typeof n === 'number' && Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/** Keeps text runs and drops marked-content markers that have no string. */
export function textRunsFromItems(items: readonly Record<string, unknown>[]): PdfTextRun[] {
  const runs: PdfTextRun[] = [];
  for (const item of items) {
    if (typeof item.str !== 'string' || item.str === '') continue;
    const height = numberAt(item.height, 0);
    runs.push({
      str: item.str,
      x: numberAt(item.transform, 4),
      y: numberAt(item.transform, 5),
      width: numberAt(item.width, 0),
      height: height > 0 ? height : 10,
      hasEOL: item.hasEOL === true,
    });
  }
  return runs;
}

/**
 * Rebuilds lines from PDF text runs. PDF y grows upward, so a higher y is an
 * earlier line. A gap wider than a fraction of the glyph height becomes a space.
 */
export function layoutTextRuns(runs: readonly PdfTextRun[]): string {
  if (runs.length === 0) return '';
  const sorted = [...runs].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: PdfTextRun[][] = [];
  for (const run of sorted) {
    const last = lines.at(-1);
    const height = Math.max(run.height, last?.[0]?.height ?? 0);
    const tolerance = Math.max(2, height * 0.45);
    const anchor = last?.[0];
    if (last && anchor && Math.abs(anchor.y - run.y) <= tolerance) last.push(run);
    else lines.push([run]);
  }

  const text = lines
    .map((line) => {
      const parts = [...line].sort((a, b) => a.x - b.x);
      let row = '';
      let end = Number.NEGATIVE_INFINITY;
      for (const part of parts) {
        if (row !== '' && !row.endsWith('\n')) {
          const gap = part.x - end;
          const spaced = /\s$/.test(row) || /^\s/.test(part.str);
          if (!spaced && gap > Math.max(1.5, part.height * 0.17)) row += ' ';
        }
        row += part.str;
        end = part.x + part.width;
        if (part.hasEOL && !row.endsWith('\n')) row += '\n';
      }
      return row.replace(/[ \t]+\n/g, '\n').replace(/[ \t]+$/g, '');
    })
    .join('\n');
  return text
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\n+/, '')
    .replace(/\n+$/, '');
}

async function loadPdfJs() {
  const g = globalThis as { pdfjsWorker?: unknown };
  if (!g.pdfjsWorker) {
    g.pdfjsWorker = await import('pdfjs-dist/build/pdf.worker.min.mjs');
  }
  return await import('pdfjs-dist/build/pdf.mjs');
}

function readError(error: unknown): ToolInputError {
  if (error instanceof ToolInputError) return error;
  const name = error instanceof Error ? error.name : '';
  const message = error instanceof Error ? error.message : '';
  if (name === 'PasswordException' || /password/i.test(message)) {
    return new ToolInputError('This PDF is encrypted. Text can be read after the password is removed.');
  }
  return new ToolInputError(
    message ? `Could not read this PDF: ${message}` : 'Could not read this PDF. It may be damaged or not a PDF.',
  );
}

function pageBody(text: string): { text: string; hasText: boolean } {
  const trimmed = text.trim();
  if (trimmed === '') return { text: '', hasText: false };
  return { text: trimmed, hasText: true };
}

/**
 * Extracts the text layer with pdf.js. Eval, system fonts and font-face loading
 * stay off. A page with no text is reported as empty; nothing is OCR'd.
 */
export async function extractPdfText(
  pdfBytes: Uint8Array,
  options: { pageSpec?: string } = {},
): Promise<PdfTextResult> {
  if (pdfBytes.length === 0) throw new ToolInputError('Choose a PDF file.');
  if (pdfBytes.length > MAX_PDF_BYTES) throw new ToolInputError('PDF file exceeds the 64 MB limit.');

  const pdfjs = await loadPdfJs();
  let task: ReturnType<typeof pdfjs.getDocument> | undefined;
  try {
    task = pdfjs.getDocument({
      data: new Uint8Array(pdfBytes),
      isEvalSupported: false,
      useSystemFonts: false,
      disableFontFace: true,
      verbosity: 0,
    });
    const doc = await task.promise;
    const selected = parsePageSelection(options.pageSpec?.trim() ? options.pageSpec : 'all', doc.numPages);
    if (selected.length === 0) throw new ToolInputError('No pages match that selection.');

    const pages: PdfTextPage[] = [];
    let used = 0;
    for (const pageNumber of selected) {
      const page = await doc.getPage(pageNumber);
      const content = await page.getTextContent();
      const laid = pageBody(layoutTextRuns(textRunsFromItems(content.items)));
      used += laid.hasText ? laid.text.length : EMPTY_PAGE.length;
      if (used > MAX_TEXT_CHARS) throw new ToolInputError('The extracted text is too long. Select fewer pages.');
      pages.push({ pageNumber, text: laid.text, hasText: laid.hasText });
    }

    const chunks = pages.map((page) => {
      const body = page.hasText ? page.text : EMPTY_PAGE;
      return pages.length > 1 ? `Page ${page.pageNumber}\n${body}` : body;
    });
    return {
      text: chunks.join('\n\n'),
      pageCount: doc.numPages,
      selected: pages.length,
      emptyPages: pages.filter((page) => !page.hasText).length,
    };
  } catch (error) {
    throw readError(error);
  } finally {
    await task?.destroy().catch(() => undefined);
  }
}
