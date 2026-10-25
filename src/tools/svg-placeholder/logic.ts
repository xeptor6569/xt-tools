import { ToolInputError } from '../types.ts';

const MAX_INPUT = 100_000;
const MAX_SIDE = 4096;

/**
 * `width height label` → an SVG placeholder. The label is escaped.
 * Example: `640 480 Hello`.
 */
export function svgPlaceholder(input: string): string {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large.');
  const text = input.trim();
  if (text === '') return '';
  const match = /^(\d+)\s+(\d+)(?:\s+([\s\S]+))?$/.exec(text);
  if (!match) throw new ToolInputError('Use "width height label", for example 640 480 Hello.');
  const width = side(match[1] ?? '', 'Width');
  const height = side(match[2] ?? '', 'Height');
  const label = (match[3] ?? `${width}×${height}`).trim().replace(/\s+/g, ' ');
  if (label.length > 200) throw new ToolInputError('Label must be 200 characters or fewer.');
  const escaped = xmlEscape(label);
  const font = fontSize(width, height, label.length);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escaped}">`,
    `<rect width="100%" height="100%" fill="#e2e8f0"/>`,
    `<rect x="0.5" y="0.5" width="${Math.max(0, width - 1)}" height="${Math.max(0, height - 1)}" fill="none" stroke="#94a3b8"/>`,
    `<text x="${width / 2}" y="${height / 2}" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="${font}" fill="#334155">${escaped}</text>`,
    `</svg>`,
  ].join('');
}

function side(token: string, label: string): number {
  if (!/^\d+$/.test(token)) throw new ToolInputError(`${label} must be a whole number.`);
  const value = Number(token);
  if (value < 1 || value > MAX_SIDE) throw new ToolInputError(`${label} must be from 1 to ${MAX_SIDE}.`);
  return value;
}

function fontSize(width: number, height: number, chars: number): number {
  const byBox = Math.round(Math.min(width, height) / 6);
  const byLabel = Math.floor((width * 0.85) / Math.max(chars, 1));
  return Math.max(8, Math.min(byBox, byLabel, 160));
}

export function xmlEscape(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => {
    if (ch === '&') return '&amp;';
    if (ch === '<') return '&lt;';
    if (ch === '>') return '&gt;';
    if (ch === '"') return '&quot;';
    return '&apos;';
  });
}
