// Arithmetic expressions without eval, Function, or with.
// Trigonometry is in degrees. Shared by the math evaluator, the unit
// calculator (which adds units) and the graph plotter (which binds x).
import { ToolInputError } from '../tools/types.ts';

export const MAX_EXPRESSION_LENGTH = 10_000;
export const MAX_EXPRESSION_DEPTH = 64;

export type BinaryOp = '+' | '-' | '*' | '/' | '%' | '^';

export type Expr =
  | { kind: 'number'; value: number; unit?: string }
  | { kind: 'ident'; name: string }
  | { kind: 'unary'; op: '+' | '-'; expr: Expr }
  | { kind: 'binary'; op: BinaryOp; left: Expr; right: Expr }
  | { kind: 'call'; name: string; args: Expr[] }
  | { kind: 'convert'; expr: Expr; unit: string };

export interface ParseOptions {
  maxLength?: number;
  maxDepth?: number;
  /** Allow `5 km` and a trailing `to m`. */
  units?: boolean;
}

const CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  PI: Math.PI,
  e: Math.E,
  E: Math.E,
};

interface Fn {
  min: number;
  max: number;
  call: (args: number[]) => number;
}

function arity(name: string, args: number[], n: number): void {
  if (args.length !== n) {
    throw new ToolInputError(`${name} expects ${n} argument${n === 1 ? '' : 's'}.`);
  }
}

/** Snap binary-float noise from exact degree results (sin(180), tan(45)). */
function clean(n: number): number {
  if (!Number.isFinite(n)) throw new ToolInputError('Result is not a finite number.');
  if (Math.abs(n) < 1e-12) return 0;
  const nearest = Math.round(n);
  if (Math.abs(n - nearest) < 1e-10) return nearest;
  return n;
}

function deg(degValue: number, fn: (rad: number) => number): number {
  return clean(fn((degValue * Math.PI) / 180));
}

const FUNCTIONS: Record<string, Fn> = {
  sqrt: {
    min: 1,
    max: 1,
    call: (args) => {
      arity('sqrt', args, 1);
      const x = args[0]!;
      if (x < 0) throw new ToolInputError('sqrt of a negative number is not real.');
      return Math.sqrt(x);
    },
  },
  sin: { min: 1, max: 1, call: (args) => (arity('sin', args, 1), deg(args[0]!, Math.sin)) },
  cos: { min: 1, max: 1, call: (args) => (arity('cos', args, 1), deg(args[0]!, Math.cos)) },
  tan: {
    min: 1,
    max: 1,
    call: (args) => {
      arity('tan', args, 1);
      const rad = (args[0]! * Math.PI) / 180;
      const c = Math.cos(rad);
      if (Math.abs(c) < 1e-12) throw new ToolInputError('tan is undefined at this angle.');
      return clean(Math.sin(rad) / c);
    },
  },
  log: {
    min: 1,
    max: 1,
    call: (args) => {
      arity('log', args, 1);
      const x = args[0]!;
      if (x <= 0) throw new ToolInputError('log is only defined for positive numbers.');
      return Math.log10(x);
    },
  },
  ln: {
    min: 1,
    max: 1,
    call: (args) => {
      arity('ln', args, 1);
      const x = args[0]!;
      if (x <= 0) throw new ToolInputError('ln is only defined for positive numbers.');
      return Math.log(x);
    },
  },
  abs: { min: 1, max: 1, call: (args) => (arity('abs', args, 1), Math.abs(args[0]!)) },
  floor: { min: 1, max: 1, call: (args) => (arity('floor', args, 1), Math.floor(args[0]!)) },
  ceil: { min: 1, max: 1, call: (args) => (arity('ceil', args, 1), Math.ceil(args[0]!)) },
  round: { min: 1, max: 1, call: (args) => (arity('round', args, 1), Math.round(args[0]!)) },
  min: {
    min: 1,
    max: 32,
    call: (args) => {
      if (args.length < 1) throw new ToolInputError('min expects at least 1 argument.');
      return Math.min(...args);
    },
  },
  max: {
    min: 1,
    max: 32,
    call: (args) => {
      if (args.length < 1) throw new ToolInputError('max expects at least 1 argument.');
      return Math.max(...args);
    },
  },
  pow: {
    min: 2,
    max: 2,
    call: (args) => {
      arity('pow', args, 2);
      const v = Math.pow(args[0]!, args[1]!);
      if (!Number.isFinite(v)) throw new ToolInputError('Result is not a finite number.');
      return v;
    },
  },
};

export function callFunction(name: string, args: number[]): number {
  const fn = FUNCTIONS[name.toLowerCase()];
  if (!fn) throw new ToolInputError(`Unknown function "${name}".`);
  if (args.length < fn.min || args.length > fn.max) {
    const expect = fn.min === fn.max ? String(fn.min) : `${fn.min}–${fn.max}`;
    throw new ToolInputError(`${name.toLowerCase()} expects ${expect} argument${fn.max === 1 ? '' : 's'}.`);
  }
  const value = fn.call(args);
  if (!Number.isFinite(value)) throw new ToolInputError('Result is not a finite number.');
  return value;
}

export function applyOperator(op: BinaryOp, left: number, right: number): number {
  let value: number;
  switch (op) {
    case '+':
      value = left + right;
      break;
    case '-':
      value = left - right;
      break;
    case '*':
      value = left * right;
      break;
    case '/':
      if (right === 0) throw new ToolInputError('Division by zero.');
      value = left / right;
      break;
    case '%':
      if (right === 0) throw new ToolInputError('Division by zero.');
      value = left % right;
      break;
    case '^':
      value = Math.pow(left, right);
      break;
    default:
      throw new ToolInputError('Unknown operator.');
  }
  if (!Number.isFinite(value)) throw new ToolInputError('Result is not a finite number.');
  return value;
}

/** Fixed display that hides binary float noise (0.1 + 0.2) without scientific noise for ordinary values. */
export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) throw new ToolInputError('Result is not a finite number.');
  if (n === 0) return '0';
  const rounded = Number(n.toPrecision(12));
  if (rounded === 0) return '0';
  const abs = Math.abs(rounded);
  if (abs >= 1e12 || abs < 1e-6) {
    return rounded
      .toExponential(8)
      .replace(/\.?0+e/, 'e')
      .replace(/e\+/, 'e');
  }
  let text = String(rounded);
  if (text.includes('e') || text.includes('E')) {
    text = rounded.toFixed(12).replace(/0+$/, '').replace(/\.$/, '');
  }
  return text === '-0' ? '0' : text;
}

/**
 * Reject unknown names, unknown functions, wrong arity, and unit syntax.
 * Does not evaluate, so `1/x` is accepted and division by zero is left to the caller.
 */
export function validateExpr(expr: Expr, allowed: readonly string[]): void {
  const extra = new Set(allowed);
  const walk = (node: Expr): void => {
    switch (node.kind) {
      case 'number':
        if (node.unit) throw new ToolInputError('Units belong in the unit calculator.');
        return;
      case 'ident':
        if (extra.has(node.name) || CONSTANTS[node.name] !== undefined) return;
        throw new ToolInputError(`Unknown name "${node.name}".`);
      case 'unary':
        walk(node.expr);
        return;
      case 'binary':
        walk(node.left);
        walk(node.right);
        return;
      case 'call': {
        const fn = FUNCTIONS[node.name.toLowerCase()];
        if (!fn) throw new ToolInputError(`Unknown function "${node.name}".`);
        if (node.args.length < fn.min || node.args.length > fn.max) {
          const expect = fn.min === fn.max ? String(fn.min) : `${fn.min}–${fn.max}`;
          throw new ToolInputError(`${node.name.toLowerCase()} expects ${expect} argument${fn.max === 1 ? '' : 's'}.`);
        }
        for (const arg of node.args) walk(arg);
        return;
      }
      case 'convert':
        throw new ToolInputError('Units belong in the unit calculator.');
      default:
        throw new ToolInputError('Unknown expression.');
    }
  };
  walk(expr);
}

export function evaluateExpr(expr: Expr, vars: Readonly<Record<string, number>> = {}): number {
  switch (expr.kind) {
    case 'number':
      if (expr.unit) throw new ToolInputError('Units belong in the unit calculator.');
      return expr.value;
    case 'ident': {
      if (Object.prototype.hasOwnProperty.call(vars, expr.name)) return vars[expr.name]!;
      const constant = CONSTANTS[expr.name];
      if (constant !== undefined) return constant;
      throw new ToolInputError(`Unknown name "${expr.name}".`);
    }
    case 'unary': {
      const value = evaluateExpr(expr.expr, vars);
      return expr.op === '-' ? -value : value;
    }
    case 'binary':
      return applyOperator(expr.op, evaluateExpr(expr.left, vars), evaluateExpr(expr.right, vars));
    case 'call':
      return callFunction(
        expr.name,
        expr.args.map((arg) => evaluateExpr(arg, vars)),
      );
    case 'convert':
      throw new ToolInputError('Units belong in the unit calculator.');
    default:
      throw new ToolInputError('Unknown expression.');
  }
}

export function parseExpr(input: string, options: ParseOptions = {}): Expr {
  const maxLength = options.maxLength ?? MAX_EXPRESSION_LENGTH;
  const maxDepth = options.maxDepth ?? MAX_EXPRESSION_DEPTH;
  if (input.length > maxLength) {
    throw new ToolInputError(`Expression is too long (maximum ${maxLength} characters).`);
  }
  const s = input;
  let i = 0;

  const skip = () => {
    while (i < s.length && /\s/.test(s[i]!)) i++;
  };

  const tooDeep = (depth: number) => {
    if (depth > maxDepth) throw new ToolInputError(`Expression is nested too deeply (maximum ${maxDepth}).`);
  };

  const readNumber = (): number => {
    const m = /^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i.exec(s.slice(i));
    if (!m) throw new ToolInputError('Expected a number.');
    i += m[0].length;
    const n = Number(m[0]);
    if (!Number.isFinite(n)) throw new ToolInputError('That number is too large.');
    return n;
  };

  const readIdent = (): string => {
    const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(s.slice(i));
    if (!m) throw new ToolInputError('Expected a name.');
    i += m[0].length;
    return m[0];
  };

  const readUnitToken = (required: boolean): string | undefined => {
    const mark = i;
    skip();
    const start = i;
    if (s[i] === '°') i++;
    const ch = s[i];
    if (ch === undefined || !/[A-Za-zµμ]/.test(ch)) {
      i = mark;
      if (required) throw new ToolInputError('Expected a unit after "to".');
      return undefined;
    }
    i++;
    while (i < s.length && /[A-Za-z0-9µμ]/.test(s[i]!)) i++;
    if (s[i] === '/') {
      const slash = i;
      i++;
      const next = s[i];
      if (next !== undefined && /[A-Za-zµμ]/.test(next)) {
        i++;
        while (i < s.length && /[A-Za-z0-9µμ]/.test(s[i]!)) i++;
      } else {
        i = slash;
      }
    }
    const token = s.slice(start, i);
    let j = i;
    while (j < s.length && /\s/.test(s[j]!)) j++;
    if (s[j] === '(' || (!required && token.toLowerCase() === 'to')) {
      i = mark;
      if (required) throw new ToolInputError('Expected a unit after "to".');
      return undefined;
    }
    return token;
  };

  const matchKeyword = (word: string): boolean => {
    const mark = i;
    skip();
    if (s.slice(i, i + word.length).toLowerCase() !== word) {
      i = mark;
      return false;
    }
    const after = s[i + word.length];
    if (after !== undefined && /[A-Za-z0-9_µμ]/.test(after)) {
      i = mark;
      return false;
    }
    i += word.length;
    return true;
  };

  const parseExpression = (depth: number): Expr => {
    tooDeep(depth);
    let left = parseTerm(depth);
    for (;;) {
      skip();
      const op = s[i];
      if (op !== '+' && op !== '-') break;
      i++;
      const right = parseTerm(depth);
      left = { kind: 'binary', op, left, right };
    }
    return left;
  };

  const parseTerm = (depth: number): Expr => {
    let left = parseUnary(depth);
    for (;;) {
      skip();
      const op = s[i];
      if (op !== '*' && op !== '/' && op !== '%') break;
      i++;
      const right = parseUnary(depth);
      left = { kind: 'binary', op, left, right };
    }
    return left;
  };

  // Unary minus binds looser than ^, so -2^2 is -(2^2). ^ is right-associative.
  const parseUnary = (depth: number): Expr => {
    tooDeep(depth);
    skip();
    const op = s[i];
    if (op === '+' || op === '-') {
      i++;
      return { kind: 'unary', op, expr: parseUnary(depth + 1) };
    }
    return parsePower(depth);
  };

  const parsePower = (depth: number): Expr => {
    const base = parsePrimary(depth);
    skip();
    if (s[i] !== '^') return base;
    i++;
    const exp = parseUnary(depth + 1);
    return { kind: 'binary', op: '^', left: base, right: exp };
  };

  const parsePrimary = (depth: number): Expr => {
    tooDeep(depth);
    skip();
    const c = s[i];
    if (c === undefined) throw new ToolInputError('Unexpected end of expression.');
    if (c === '(') {
      i++;
      const inner = parseExpression(depth + 1);
      skip();
      if (s[i] !== ')') throw new ToolInputError('Missing closing parenthesis.');
      i++;
      return inner;
    }
    if (c === '.' || (c >= '0' && c <= '9')) {
      const value = readNumber();
      const unit = options.units ? readUnitToken(false) : undefined;
      return unit ? { kind: 'number', value, unit } : { kind: 'number', value };
    }
    if (/[A-Za-z_]/.test(c)) {
      const name = readIdent();
      skip();
      if (s[i] !== '(') return { kind: 'ident', name };
      i++;
      const args: Expr[] = [];
      skip();
      if (s[i] !== ')') {
        for (;;) {
          if (args.length >= 32) throw new ToolInputError('Too many function arguments.');
          args.push(parseExpression(depth + 1));
          skip();
          if (s[i] === ',') {
            i++;
            continue;
          }
          break;
        }
      }
      skip();
      if (s[i] !== ')') throw new ToolInputError('Missing closing parenthesis.');
      i++;
      return { kind: 'call', name, args };
    }
    throw new ToolInputError(`Unexpected "${c}".`);
  };

  skip();
  if (i >= s.length) throw new ToolInputError('Enter an expression.');
  let expr = parseExpression(0);
  if (options.units && matchKeyword('to')) {
    const unit = readUnitToken(true);
    if (!unit) throw new ToolInputError('Expected a unit after "to".');
    expr = { kind: 'convert', expr, unit };
  }
  skip();
  if (i < s.length) throw new ToolInputError(`Unexpected "${s.slice(i, i + 24)}".`);
  return expr;
}
