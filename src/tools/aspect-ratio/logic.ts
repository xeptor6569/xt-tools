import { ToolInputError } from '../types.ts';

const MAX_INPUT = 10_000;

/**
 * `1920 1080` prints the simplified ratio.
 * `16:9 width 1280` or `16:9 height 720` fills in the missing side.
 */
export function aspectRatio(input: string): string {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large.');
  const text = input.trim().toLowerCase();
  if (text === '') return '';

  const sized = /^(\d+(?:\.\d+)?)\s*[:/]\s*(\d+(?:\.\d+)?)\s+(width|height|w|h)\s+(\d+(?:\.\d+)?)$/.exec(text);
  if (sized) {
    const ratioW = positive(sized[1] ?? '', 'Ratio width');
    const ratioH = positive(sized[2] ?? '', 'Ratio height');
    const known = positive(sized[4] ?? '', 'Size');
    const widthKnown = sized[3] === 'width' || sized[3] === 'w';
    const width = widthKnown ? known : (known * ratioW) / ratioH;
    const height = widthKnown ? (known * ratioH) / ratioW : known;
    return formatResult(ratioW, ratioH, width, height);
  }

  const pair = /^(\d+(?:\.\d+)?)\s*[x× ]\s*(\d+(?:\.\d+)?)$/.exec(text);
  if (pair) {
    const width = positive(pair[1] ?? '', 'Width');
    const height = positive(pair[2] ?? '', 'Height');
    return formatResult(width, height, width, height);
  }

  throw new ToolInputError('Use "1920 1080" or "16:9 width 1280".');
}

function positive(token: string, label: string): number {
  const value = Number(token);
  if (!Number.isFinite(value) || value <= 0 || value > 1e7) {
    throw new ToolInputError(`${label} must be greater than 0 and at most 10000000.`);
  }
  return value;
}

function formatResult(ratioW: number, ratioH: number, width: number, height: number): string {
  return `${simplify(ratioW, ratioH)}\nwidth ${formatNumber(width)}\nheight ${formatNumber(height)}`;
}

function simplify(width: number, height: number): string {
  let a = Math.round(width * 1000);
  let b = Math.round(height * 1000);
  if (a < 1 || b < 1) throw new ToolInputError('Ratio parts must be greater than 0.');
  const divisor = gcd(a, b);
  a /= divisor;
  b /= divisor;
  return `${a}:${b}`;
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const next = x % y;
    x = y;
    y = next;
  }
  return x || 1;
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) throw new ToolInputError('That size is not a finite number.');
  const nearest = Math.round(value);
  if (Math.abs(value - nearest) < 1e-6) return String(nearest);
  return (Math.round(value * 100) / 100).toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}
