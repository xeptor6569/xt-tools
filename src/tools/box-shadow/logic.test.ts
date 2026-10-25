import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { boxShadow } from './logic.ts';
import meta from './meta.ts';

describe('boxShadow', () => {
  it('builds a CSS declaration from offset, blur, spread, color and inset', () => {
    expect(boxShadow('4 8 24 0 #000000')).toBe('box-shadow: 4px 8px 24px 0px #000000;');
    expect(boxShadow('inset 0 2px 4 0 #fff')).toBe('box-shadow: inset 0px 2px 4px 0px #ffffff;');
    expect(boxShadow('-2 4 8 -1 #00000080')).toBe('box-shadow: -2px 4px 8px -1px #00000080;');
  });

  it('rejects a negative blur', () => {
    expect(() => boxShadow('0 0 -1 0 #000')).toThrow(ToolInputError);
  });

  it('runs the meta examples', () => {
    for (const example of meta.examples ?? []) expect(boxShadow(example.input)).toContain(example.expect);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(boxShadow, { malformed: ['1 2 3', 'inset', '0 0 0 0 red'] });
  });
});
