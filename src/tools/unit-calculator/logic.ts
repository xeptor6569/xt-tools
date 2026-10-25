import { applyOperator, callFunction, formatNumber, parseExpr, type Expr } from '../../lib/safe-expr.ts';
import { ToolInputError } from '../types.ts';
import { lookupUnit, type Dim, type UnitDef } from './units.ts';

const MAX_INPUT = 10_000;

interface LinearQty {
  type: 'linear';
  dim: Dim;
  si: number;
  label: string | null;
  perSi: number;
}

interface TempQty {
  type: 'temp';
  kelvin: number;
  unit: Extract<UnitDef, { kind: 'temp' }>;
}

type Qty = LinearQty | TempQty;

function sameDim(a: Dim, b: Dim): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

function zeroDim(d: Dim): boolean {
  return d[0] === 0 && d[1] === 0 && d[2] === 0;
}

function dimensionless(value: number): LinearQty {
  return { type: 'linear', dim: [0, 0, 0], si: value, label: null, perSi: 1 };
}

function requireUnit(token: string): UnitDef {
  const unit = lookupUnit(token);
  if (!unit) throw new ToolInputError(`Unknown unit "${token}".`);
  return unit;
}

function fromNumber(value: number, unitToken: string | undefined): Qty {
  if (!unitToken) return dimensionless(value);
  const unit = requireUnit(unitToken);
  if (unit.kind === 'temp') return { type: 'temp', kelvin: unit.toK(value), unit };
  return { type: 'linear', dim: unit.dim, si: value * unit.perSi, label: unit.symbol, perSi: unit.perSi };
}

function asNumber(q: Qty, what: string): number {
  if (q.type !== 'linear' || !zeroDim(q.dim)) {
    throw new ToolInputError(`${what} expects a plain number, without a unit.`);
  }
  return q.si;
}

function negate(q: Qty): Qty {
  if (q.type === 'temp') {
    const shown = q.unit.fromK(q.kelvin);
    return { type: 'temp', kelvin: q.unit.toK(-shown), unit: q.unit };
  }
  return { ...q, si: -q.si };
}

function add(a: Qty, b: Qty, op: '+' | '-'): Qty {
  if (a.type === 'temp' || b.type === 'temp') {
    throw new ToolInputError('Temperature can only be converted, for example "10 F to C".');
  }
  if (!sameDim(a.dim, b.dim)) {
    throw new ToolInputError(
      'Those units are not compatible. Add lengths to lengths, masses to masses, or times to times.',
    );
  }
  const si = op === '+' ? a.si + b.si : a.si - b.si;
  if (!Number.isFinite(si)) throw new ToolInputError('Result is not a finite number.');
  if (a.label) return { type: 'linear', dim: a.dim, si, label: a.label, perSi: a.perSi };
  if (b.label) return { type: 'linear', dim: b.dim, si, label: b.label, perSi: b.perSi };
  return { type: 'linear', dim: a.dim, si, label: null, perSi: 1 };
}

function multiply(a: Qty, b: Qty): Qty {
  if (a.type === 'temp' || b.type === 'temp') {
    throw new ToolInputError('Temperature can only be converted, for example "10 F to C".');
  }
  const dim: Dim = [a.dim[0] + b.dim[0], a.dim[1] + b.dim[1], a.dim[2] + b.dim[2]];
  const si = a.si * b.si;
  if (!Number.isFinite(si)) throw new ToolInputError('Result is not a finite number.');
  if (a.label && b.label) {
    return { type: 'linear', dim, si, label: `${a.label}·${b.label}`, perSi: a.perSi * b.perSi };
  }
  if (a.label && zeroDim(b.dim)) return { type: 'linear', dim, si, label: a.label, perSi: a.perSi };
  if (b.label && zeroDim(a.dim)) return { type: 'linear', dim, si, label: b.label, perSi: b.perSi };
  return { type: 'linear', dim, si, label: null, perSi: 1 };
}

function divide(a: Qty, b: Qty): Qty {
  if (a.type === 'temp' || b.type === 'temp') {
    throw new ToolInputError('Temperature can only be converted, for example "10 F to C".');
  }
  if (b.si === 0) throw new ToolInputError('Division by zero.');
  const dim: Dim = [a.dim[0] - b.dim[0], a.dim[1] - b.dim[1], a.dim[2] - b.dim[2]];
  const si = a.si / b.si;
  if (!Number.isFinite(si)) throw new ToolInputError('Result is not a finite number.');
  if (a.label && b.label) {
    return { type: 'linear', dim, si, label: `${a.label}/${b.label}`, perSi: a.perSi / b.perSi };
  }
  if (a.label && zeroDim(b.dim)) return { type: 'linear', dim, si, label: a.label, perSi: a.perSi };
  if (b.label && zeroDim(a.dim)) {
    return { type: 'linear', dim, si, label: `1/${b.label}`, perSi: 1 / b.perSi };
  }
  return { type: 'linear', dim, si, label: null, perSi: 1 };
}

function convert(q: Qty, token: string): Qty {
  const target = requireUnit(token);
  if (q.type === 'temp') {
    if (target.kind !== 'temp') throw new ToolInputError(`Cannot convert ${q.unit.symbol} to ${target.symbol}.`);
    return { type: 'temp', kelvin: q.kelvin, unit: target };
  }
  if (target.kind === 'temp') throw new ToolInputError(`Cannot convert that quantity to ${target.symbol}.`);
  if (!sameDim(q.dim, target.dim)) {
    throw new ToolInputError(`Cannot convert ${q.label ?? 'that quantity'} to ${target.symbol}.`);
  }
  return { type: 'linear', dim: q.dim, si: q.si, label: target.symbol, perSi: target.perSi };
}

function evalQty(expr: Expr): Qty {
  switch (expr.kind) {
    case 'number':
      return fromNumber(expr.value, expr.unit);
    case 'ident': {
      if (expr.name === 'pi' || expr.name === 'PI') return dimensionless(Math.PI);
      if (expr.name === 'e' || expr.name === 'E') return dimensionless(Math.E);
      throw new ToolInputError(`Unknown name "${expr.name}".`);
    }
    case 'unary': {
      const value = evalQty(expr.expr);
      return expr.op === '-' ? negate(value) : value;
    }
    case 'binary': {
      const left = evalQty(expr.left);
      const right = evalQty(expr.right);
      if (expr.op === '+' || expr.op === '-') return add(left, right, expr.op);
      if (expr.op === '*') return multiply(left, right);
      if (expr.op === '/') return divide(left, right);
      if (left.type !== 'linear' || right.type !== 'linear' || !zeroDim(left.dim) || !zeroDim(right.dim)) {
        throw new ToolInputError('Powers and remainder need plain numbers.');
      }
      return dimensionless(applyOperator(expr.op, left.si, right.si));
    }
    case 'call': {
      const args = expr.args.map((arg) => asNumber(evalQty(arg), expr.name));
      return dimensionless(callFunction(expr.name, args));
    }
    case 'convert':
      return convert(evalQty(expr.expr), expr.unit);
    default:
      throw new ToolInputError('Unknown expression.');
  }
}

function formatDim(dim: Dim): string {
  const num: string[] = [];
  const den: string[] = [];
  const specs: Array<[string, number]> = [
    ['m', dim[0]],
    ['kg', dim[1]],
    ['s', dim[2]],
  ];
  for (const [symbol, exp] of specs) {
    if (exp > 0) num.push(exp === 1 ? symbol : `${symbol}^${exp}`);
    else if (exp < 0) den.push(exp === -1 ? symbol : `${symbol}^${-exp}`);
  }
  if (num.length === 0 && den.length === 0) return '';
  const top = num.length > 0 ? num.join('·') : '1';
  return den.length > 0 ? `${top}/${den.join('·')}` : top;
}

function formatQty(q: Qty): string {
  if (q.type === 'temp') return `${formatNumber(q.unit.fromK(q.kelvin))} ${q.unit.symbol}`;
  if (q.label) return `${formatNumber(q.si / q.perSi)} ${q.label}`;
  const symbol = formatDim(q.dim);
  return symbol ? `${formatNumber(q.si)} ${symbol}` : formatNumber(q.si);
}

/** Evaluate an expression that mixes length, mass, time and temperature. */
export function unitCalculator(input: string): string {
  if (input.length > MAX_INPUT) {
    throw new ToolInputError(`Expression is too long (maximum ${MAX_INPUT} characters).`);
  }
  const text = input.trim();
  if (text === '') return '';
  return formatQty(evalQty(parseExpr(text, { units: true })));
}
