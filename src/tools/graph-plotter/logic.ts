import { evaluateExpr, formatNumber, parseExpr, validateExpr } from '../../lib/safe-expr.ts';
import { isToolInputError, ToolInputError } from '../types.ts';

const MAX_INPUT = 10_000;

export const PLOT_X_MIN = -10;
export const PLOT_X_MAX = 10;
export const PLOT_SAMPLES = 201;

export interface PlotPoint {
  x: number;
  /** Null where the expression is undefined (division by zero, and so on). */
  y: number | null;
}

export interface PlotResult {
  text: string;
  samples: PlotPoint[];
}

const GAP =
  /^(Division by zero|Result is not a finite number|tan is undefined|sqrt of a negative|log is only defined|ln is only defined)/;

function at(expr: ReturnType<typeof parseExpr>, x: number): number | null {
  try {
    return evaluateExpr(expr, { x });
  } catch (error) {
    if (isToolInputError(error) && GAP.test(error.message)) return null;
    throw error;
  }
}

/** Sample `y` as a function of `x` on [-10, 10]. Trigonometry is in degrees. */
export function plotFunction(input: string): PlotResult {
  if (input.length > MAX_INPUT) {
    throw new ToolInputError(`Expression is too long (maximum ${MAX_INPUT} characters).`);
  }
  const text = input.trim();
  if (text === '') return { text: '', samples: [] };
  const expr = parseExpr(text);
  validateExpr(expr, ['x']);
  const samples: PlotPoint[] = [];
  for (let i = 0; i < PLOT_SAMPLES; i++) {
    const x = PLOT_X_MIN + ((PLOT_X_MAX - PLOT_X_MIN) * i) / (PLOT_SAMPLES - 1);
    samples.push({ x, y: at(expr, x) });
  }
  const lines = [-2, -1, 0, 1, 2].map((x) => {
    const y = at(expr, x);
    return y === null ? `${formatNumber(x)} → undefined` : `${formatNumber(x)} → ${formatNumber(y)}`;
  });
  return { text: lines.join('\n'), samples };
}

export function graphPlotter(input: string): string {
  return plotFunction(input).text;
}
