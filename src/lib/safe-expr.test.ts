import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../tools/types.ts';
import { evaluateExpr, formatNumber, parseExpr } from './safe-expr.ts';

const ev = (input: string) => formatNumber(evaluateExpr(parseExpr(input)));

describe('safe expression parser', () => {
  it('follows precedence, unary minus and right-associative powers', () => {
    expect(ev('1+2*3')).toBe('7');
    expect(ev('(1+2)*3')).toBe('9');
    expect(ev('-2^2')).toBe('-4');
    expect(ev('(-2)^2')).toBe('4');
    expect(ev('2^3^2')).toBe('512');
    expect(ev('2^-2')).toBe('0.25');
    expect(ev('7%3')).toBe('1');
    expect(ev('0.1+0.2')).toBe('0.3');
  });

  it('evaluates functions in degrees and the constants pi and e', () => {
    expect(ev('sin(90)')).toBe('1');
    expect(ev('sin(30)')).toBe('0.5');
    expect(ev('cos(90)')).toBe('0');
    expect(ev('tan(45)')).toBe('1');
    expect(ev('sin(180)')).toBe('0');
    expect(ev('log(1000)')).toBe('3');
    expect(ev('ln(e)')).toBe('1');
    expect(ev('sqrt(4)')).toBe('2');
    expect(ev('abs(-3)')).toBe('3');
    expect(ev('floor(1.9)')).toBe('1');
    expect(ev('ceil(1.1)')).toBe('2');
    expect(ev('round(1.5)')).toBe('2');
    expect(ev('min(3,1,2)')).toBe('1');
    expect(ev('max(3,1)')).toBe('3');
    expect(ev('pow(2,10)')).toBe('1024');
    expect(ev('sqrt(2)')).toBe('1.41421356237');
    expect(Number(ev('pi'))).toBeCloseTo(Math.PI, 10);
  });

  it('rejects unknown names, bad arity and non-real results', () => {
    expect(() => ev('foo')).toThrow(ToolInputError);
    expect(() => ev('sin()')).toThrow(ToolInputError);
    expect(() => ev('1/0')).toThrow(ToolInputError);
    expect(() => ev('sqrt(-1)')).toThrow(ToolInputError);
    expect(() => ev('tan(90)')).toThrow(ToolInputError);
    expect(() => parseExpr('')).toThrow(ToolInputError);
    expect(() => parseExpr('('.repeat(80) + '1' + ')'.repeat(80))).toThrow(/nested/i);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust((input) => {
      if (input.trim() === '') return '';
      return ev(input);
    });
  });
});
