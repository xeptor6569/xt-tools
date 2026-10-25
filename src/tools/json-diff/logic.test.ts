import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { jsonDiff } from './logic.ts';
import meta from './meta.ts';

describe('jsonDiff', () => {
  it('lists added, removed and changed paths in path order', () => {
    const text = jsonDiff('{"b":1,"a":{"x":1}}\n---\n{"b":2,"c":3,"a":{"x":1}}');
    expect(text).toBe('changed /b: 1 -> 2\nadded /c: 3');
  });

  it('compares arrays by index and reports no differences', () => {
    expect(jsonDiff('[1,2]\n---\n[1]')).toBe('removed /1: 2');
    expect(jsonDiff('{"a":1}\n---\n{"a":1}')).toBe('No differences.');
  });

  it('rejects a missing separator and invalid JSON', () => {
    expect(() => jsonDiff('{"a":1}')).toThrow(ToolInputError);
    expect(() => jsonDiff('{\n---\n}')).toThrow(ToolInputError);
    expect(jsonDiff('')).toBe('');
  });

  it('matches the published example', () => {
    for (const example of meta.examples ?? []) expect(jsonDiff(example.input)).toContain(example.expect);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(jsonDiff);
  });
});
