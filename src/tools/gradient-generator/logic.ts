import { ToolInputError } from '../types.ts';

const MAX_INPUT = 80;

export interface Gradient {
  angle: number;
  from: string;
  to: string;
  css: string;
}

function formatNum(value: number): string {
  const text = (Math.round(value * 10000) / 10000).toFixed(4).replace(/\.?0+$/, '');
  return text === '-0' ? '0' : text;
}

export function normalizeHex(token: string): string {
  const match = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(token);
  const hex = match?.[1];
  if (!hex) throw new ToolInputError(`"${token}" is not a hex color such as #000000.`);
  const full =
    hex.length <= 4
      ? Array.from(hex)
          .map((ch) => ch + ch)
          .join('')
      : hex;
  return `#${full.toLowerCase()}`;
}

function parseAngle(token: string): number {
  const match = /^([+-]?\d+(?:\.\d+)?)(?:deg)?$/i.exec(token);
  const raw = match?.[1];
  if (raw === undefined) throw new ToolInputError('Start with an angle in degrees, for example 90.');
  const angle = Number(raw);
  if (!Number.isFinite(angle) || angle < -3600 || angle > 3600) {
    throw new ToolInputError('Enter an angle in degrees, for example 90.');
  }
  return angle;
}

/** Parses `90 #000000 #ffffff` into a CSS linear-gradient. Empty input returns undefined. */
export function parseGradient(input: string): Gradient | undefined {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 80 characters).');
  const text = input.trim();
  if (text === '') return undefined;
  const tokens = text
    .split(/\s+/)
    .map((token) => token.replace(/,$/, ''))
    .filter(Boolean);
  if (tokens.length !== 3) {
    throw new ToolInputError('Enter an angle and two hex colors, for example: 90 #000000 #ffffff');
  }
  const [angleToken, fromToken, toToken] = tokens;
  if (!angleToken || !fromToken || !toToken) {
    throw new ToolInputError('Enter an angle and two hex colors, for example: 90 #000000 #ffffff');
  }
  const angle = parseAngle(angleToken);
  const from = normalizeHex(fromToken);
  const to = normalizeHex(toToken);
  const css = `linear-gradient(${formatNum(angle)}deg, ${from}, ${to})`;
  return { angle, from, to, css };
}

export function formatGradientInput(angle: number, from: string, to: string): string {
  return `${formatNum(angle)} ${from} ${to}`;
}

/** Builds the CSS linear-gradient() text for an angle and two colors. */
export function gradientGenerator(input: string): string {
  return parseGradient(input)?.css ?? '';
}
