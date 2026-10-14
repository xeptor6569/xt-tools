// Shared robustness check for tool logic. See PLAN.md section 13.1.
import { expect } from 'vitest';
import { isToolInputError } from '../../src/tools/types.ts';

export interface RobustOptions {
  /** Tool-specific malformed inputs, in addition to the built-in ones. */
  malformed?: string[];
  /** Maximum time per call, in milliseconds. */
  timeLimitMs?: number;
}

const BUILT_IN: Array<[string, string]> = [
  ['empty string', ''],
  ['whitespace', ' \t\n\r '],
  ['5 MB string', 'a'.repeat(5 * 1024 * 1024)],
  ['lone surrogates', '\uD800 \uDFFF x\uD83D'],
  ['NUL and control characters', '\0\u0001\u001f\u007f'],
  ['mixed scripts and emoji', 'Ünïcödé 日本語 مرحبا 👩‍👩‍👧‍👦 \u202Eevil'],
];

/**
 * Calls `fn` with empty, whitespace, very large and malformed input. Each call
 * must return or throw a ToolInputError within the time limit. Any other
 * exception fails the test.
 */
export function expectRobust(fn: (input: string) => unknown, options: RobustOptions = {}): void {
  const { malformed = [], timeLimitMs = 2000 } = options;
  const cases: Array<[string, string]> = [
    ...BUILT_IN,
    ...malformed.map((m, i): [string, string] => [`malformed #${i + 1}`, m]),
  ];

  for (const [label, input] of cases) {
    const start = performance.now();
    try {
      const result = fn(input);
      expect(result instanceof Promise, `${label}: use expectRobustAsync for async functions`).toBe(false);
    } catch (error) {
      expect(isToolInputError(error), `${label}: threw ${String(error)} instead of ToolInputError`).toBe(true);
    }
    const elapsed = performance.now() - start;
    expect(elapsed, `${label}: took ${Math.round(elapsed)} ms (limit ${timeLimitMs} ms)`).toBeLessThan(timeLimitMs);
  }
}

/** Async variant of expectRobust for logic that returns a Promise. */
export async function expectRobustAsync(
  fn: (input: string) => Promise<unknown>,
  options: RobustOptions = {},
): Promise<void> {
  const { malformed = [], timeLimitMs = 2000 } = options;
  const cases: Array<[string, string]> = [
    ...BUILT_IN,
    ...malformed.map((m, i): [string, string] => [`malformed #${i + 1}`, m]),
  ];

  for (const [label, input] of cases) {
    const start = performance.now();
    try {
      await fn(input);
    } catch (error) {
      expect(isToolInputError(error), `${label}: threw ${String(error)} instead of ToolInputError`).toBe(true);
    }
    const elapsed = performance.now() - start;
    expect(elapsed, `${label}: took ${Math.round(elapsed)} ms (limit ${timeLimitMs} ms)`).toBeLessThan(timeLimitMs);
  }
}
