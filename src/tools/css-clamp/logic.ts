import { ToolInputError } from '../types.ts';

const MAX_INPUT = 120;

export interface FluidTerms {
  /** Preferred-size coefficient of 1vw. */
  vw: number;
  /** Preferred-size intercept, in the same unit as the sizes. */
  intercept: number;
  unit: string;
}

function formatNum(value: number): string {
  const text = (Math.round(value * 10000) / 10000).toFixed(4).replace(/\.?0+$/, '');
  return text === '-0' ? '0' : text;
}

function sharedUnit(left: string | undefined, right: string | undefined, label: string): string {
  const a = left?.toLowerCase();
  const b = right?.toLowerCase();
  if (a && b && a !== b) throw new ToolInputError(`Use the same unit for both ${label}.`);
  return a || b || 'px';
}

/**
 * Linear interpolation from `min` at viewport `from` to `max` at viewport `to`.
 * `vw` is the coefficient of 1vw. `intercept` is the remaining length.
 */
export function fluidTerms(min: number, max: number, from: number, to: number, unit = 'px'): FluidTerms {
  if (from === to) throw new ToolInputError('The two viewport widths must be different.');
  const slope = (max - min) / (to - from);
  return { vw: slope * 100, intercept: min - slope * from, unit };
}

function preferredExpr(terms: FluidTerms): string {
  const vwText = `${formatNum(terms.vw)}vw`;
  const intercept = formatNum(terms.intercept);
  if (intercept === '0') return vwText;
  if (formatNum(terms.vw) === '0') return `${intercept}${terms.unit}`;
  if (terms.intercept > 0) return `${intercept}${terms.unit} + ${vwText}`;
  return `${vwText} - ${formatNum(Math.abs(terms.intercept))}${terms.unit}`;
}

function preferredLine(terms: FluidTerms): string {
  const mag = `${formatNum(Math.abs(terms.intercept))}${terms.unit}`;
  const sign = terms.intercept < 0 ? '-' : '+';
  return `Preferred: ${formatNum(terms.vw)}vw ${sign} ${mag}`;
}

/** Parses `min 16 max 24 from 320 to 1280` into a CSS clamp(). */
export function cssClamp(input: string): string {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 120 characters).');
  const text = input.trim();
  if (text === '') return '';
  const match =
    /^min\s+(-?\d+(?:\.\d+)?)\s*(px|rem|em)?\s+max\s+(-?\d+(?:\.\d+)?)\s*(px|rem|em)?\s+from\s+(-?\d+(?:\.\d+)?)\s*(px|rem|em)?\s+to\s+(-?\d+(?:\.\d+)?)\s*(px|rem|em)?$/i.exec(
      text,
    );
  if (!match) {
    throw new ToolInputError('Enter sizes and viewports, for example: min 16 max 24 from 320 to 1280');
  }
  const min = Number(match[1]);
  const max = Number(match[3]);
  const from = Number(match[5]);
  const to = Number(match[7]);
  if (![min, max, from, to].every(Number.isFinite)) throw new ToolInputError('Enter finite numbers.');
  if (min < 0 || max < 0) throw new ToolInputError('Sizes cannot be negative.');
  if (from <= 0 || to <= 0) throw new ToolInputError('Viewport widths must be greater than zero.');
  if (from >= to) throw new ToolInputError('The starting viewport must be smaller than the ending viewport.');
  const sizeUnit = sharedUnit(match[2], match[4], 'sizes');
  const viewportUnit = sharedUnit(match[6], match[8], 'viewport widths');
  if (sizeUnit !== viewportUnit) {
    throw new ToolInputError('Use one unit for the sizes and the viewport widths, for example px.');
  }
  const terms = fluidTerms(min, max, from, to, sizeUnit);
  const preferred = preferredExpr(terms);
  return `clamp(${formatNum(min)}${sizeUnit}, ${preferred}, ${formatNum(max)}${sizeUnit})\n${preferredLine(terms)}`;
}
