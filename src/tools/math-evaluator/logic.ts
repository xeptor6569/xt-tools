import { evaluateExpr, formatNumber, parseExpr, validateExpr } from '../../lib/safe-expr.ts';
import { ToolInputError } from '../types.ts';

const MAX_INPUT = 10_000;

/**
 * Evaluate arithmetic. Trigonometry is in degrees. `log` is base 10 and `ln` is natural.
 * `%` is remainder, `^` is power. Unknown names are rejected.
 */
export function mathEvaluator(input: string): string {
  if (input.length > MAX_INPUT) {
    throw new ToolInputError(`Expression is too long (maximum ${MAX_INPUT} characters).`);
  }
  const text = input.trim();
  if (text === '') return '';
  const expr = parseExpr(text);
  validateExpr(expr, []);
  return formatNumber(evaluateExpr(expr));
}
