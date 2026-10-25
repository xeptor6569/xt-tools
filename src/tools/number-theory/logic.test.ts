import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { isPrime, numberTheory } from './logic.ts';

describe('numberTheory', () => {
  it('factors, and computes gcd, lcm and primality', () => {
    expect(numberTheory('factor 84')).toBe('2^2 × 3 × 7');
    expect(numberTheory('gcd 12 18')).toBe('6');
    expect(numberTheory('gcd 12, -18')).toBe('6');
    expect(numberTheory('lcm 4 6')).toBe('12');
    expect(numberTheory('lcm 4 6 8')).toBe('24');
    expect(numberTheory('prime 97')).toBe('97 is prime');
    expect(numberTheory('prime 1')).toBe('1 is not prime');
    expect(numberTheory('prime 4')).toBe('4 is not prime');
    expect(numberTheory('prime 2')).toBe('2 is prime');
  });

  it('factors a semiprime past the trial limit with Pollard Rho', () => {
    expect(numberTheory(`factor ${10007n * 10009n}`)).toBe('10007 × 10009');
    expect(numberTheory('factor 100140049')).toBe('10007^2');
    expect(isPrime(10007n)).toBe(true);
    expect(isPrime(100140049n)).toBe(false);
  });

  it('refuses integers above the size cap', () => {
    expect(() => numberTheory(`factor ${1n << 64n}`)).toThrow(ToolInputError);
    expect(() => numberTheory(`prime ${1n << 64n}`)).toThrow(ToolInputError);
    expect(() => numberTheory('square 12')).toThrow(ToolInputError);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(numberTheory);
  });
});
