import { ToolInputError } from '../types.ts';

const MAX_INPUT = 80;

export interface BoxShadow {
  x: number;
  y: number;
  blur: number;
  spread: number;
  color: string;
  inset: boolean;
  /** The value, without the property name, for the preview. */
  value: string;
  /** The full CSS declaration. */
  css: string;
}

function normalizeHex(token: string): string {
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

function formatNum(value: number): string {
  const text = (Math.round(value * 100) / 100).toFixed(2).replace(/\.?0+$/, '');
  return text === '-0' ? '0' : text;
}

function px(value: number): string {
  return `${formatNum(value)}px`;
}

function parseLength(token: string, label: string, min?: number): number {
  const match = /^([+-]?\d+(?:\.\d+)?)(?:px)?$/i.exec(token);
  const raw = match?.[1];
  if (raw === undefined) throw new ToolInputError(`${label} must be a number, for example 8 or 8px.`);
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new ToolInputError(`${label} must be a finite number.`);
  if (min !== undefined && value < min) throw new ToolInputError(`${label} cannot be negative.`);
  return value;
}

function build(x: number, y: number, blur: number, spread: number, color: string, inset: boolean): BoxShadow {
  const value = `${inset ? 'inset ' : ''}${px(x)} ${px(y)} ${px(blur)} ${px(spread)} ${color}`;
  return { x, y, blur, spread, color, inset, value, css: `box-shadow: ${value};` };
}

/** Parses `4 8 24 0 #000000` or the same with `inset`. Empty input returns undefined. */
export function parseBoxShadow(input: string): BoxShadow | undefined {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 80 characters).');
  const text = input.trim();
  if (text === '') return undefined;
  let inset = false;
  const rest: string[] = [];
  for (const token of text.split(/\s+/)) {
    if (token.toLowerCase() === 'inset') inset = true;
    else rest.push(token.replace(/,$/, ''));
  }
  if (rest.length !== 5) {
    throw new ToolInputError('Enter x y blur spread and a hex color, for example: 4 8 24 0 #000000');
  }
  const [xToken, yToken, blurToken, spreadToken, colorToken] = rest;
  if (!xToken || !yToken || !blurToken || !spreadToken || !colorToken) {
    throw new ToolInputError('Enter x y blur spread and a hex color, for example: 4 8 24 0 #000000');
  }
  return build(
    parseLength(xToken, 'X offset'),
    parseLength(yToken, 'Y offset'),
    parseLength(blurToken, 'Blur', 0),
    parseLength(spreadToken, 'Spread'),
    normalizeHex(colorToken),
    inset,
  );
}

export function formatBoxShadowInput(
  shadow: Pick<BoxShadow, 'x' | 'y' | 'blur' | 'spread' | 'color' | 'inset'>,
): string {
  const body = `${formatNum(shadow.x)} ${formatNum(shadow.y)} ${formatNum(shadow.blur)} ${formatNum(shadow.spread)} ${shadow.color}`;
  return shadow.inset ? `inset ${body}` : body;
}

/** Builds a CSS box-shadow declaration. */
export function boxShadow(input: string): string {
  return parseBoxShadow(input)?.css ?? '';
}
