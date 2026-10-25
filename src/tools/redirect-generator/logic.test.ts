import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { redirectGenerator } from './logic.ts';
import meta from './meta.ts';

describe('redirectGenerator', () => {
  it('writes nginx and Apache rules', () => {
    const text = redirectGenerator('301 /old /new');
    expect(text).toContain('location = /old {\n    return 301 /new;\n}');
    expect(text).toContain('Redirect 301 /old /new');
  });

  it('defaults to 301 and accepts several lines', () => {
    const text = redirectGenerator('/old /new\n302 /a /b');
    expect(text).toContain('return 301 /new;');
    expect(text).toContain('Redirect 302 /a /b');
  });

  it('rejects a non-redirect status', () => {
    expect(() => redirectGenerator('200 /old /new')).toThrow(ToolInputError);
    expect(() => redirectGenerator('hello')).toThrow(ToolInputError);
    expect(redirectGenerator('')).toBe('');
  });

  it('matches the published example', () => {
    for (const example of meta.examples ?? []) expect(redirectGenerator(example.input)).toContain(example.expect);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(redirectGenerator);
  });
});
