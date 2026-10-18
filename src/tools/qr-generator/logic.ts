import { encode } from 'uqr';
import { ToolInputError } from '../types.ts';

export type Ecc = 'L' | 'M' | 'Q' | 'H';

export interface QrCode {
  version: number;
  /** Modules per side, including the quiet-zone border. */
  size: number;
  /** One SVG path covering every dark module, in module units. */
  path: string;
}

const MAX_INPUT = 4000;

/** Encodes text as a QR code and returns its dark modules as an SVG path. */
export function qrGenerator(input: string, ecc: Ecc = 'M', border = 4): QrCode | undefined {
  if (input === '') return undefined;
  if (input.length > MAX_INPUT)
    throw new ToolInputError(`Too much text for a QR code (maximum ${MAX_INPUT} characters here).`);
  let result;
  try {
    result = encode(input, { ecc, border });
  } catch {
    throw new ToolInputError(
      'Too much data for a QR code at this error-correction level. Try a lower level or less text.',
    );
  }
  // Merge horizontal runs of dark modules into one rectangle each.
  const parts: string[] = [];
  result.data.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (!row[x]) continue;
      let w = 1;
      while (row[x + w]) w++;
      parts.push(`M${x} ${y}h${w}v1h-${w}z`);
      x += w - 1;
    }
  });
  return { version: result.version, size: result.size, path: parts.join('') };
}

/** A standalone SVG file for download. */
export function qrSvg(qr: QrCode, dark = '#000000', light = '#ffffff'): string {
  const safe = (c: string) => (/^#[0-9a-f]{6}$/i.test(c) ? c : '#000000');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${qr.size} ${qr.size}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="${safe(light)}"/><path fill="${safe(dark)}" d="${qr.path}"/></svg>\n`;
}
