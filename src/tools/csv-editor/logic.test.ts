import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { csvEditor, csvTextTable, deleteEmptyRows, transposeCsv } from './logic.ts';
import meta from './meta.ts';

describe('csvEditor', () => {
  it('round-trips a tiny CSV, including quotes', () => {
    expect(csvEditor('hello')).toBe('hello');
    expect(csvEditor('a,b\n1,2')).toBe('a,b\n1,2');
    expect(csvEditor('say,"hello, world"')).toBe('say,"hello, world"');
    expect(csvEditor('a,"b\nc"')).toBe('a,"b\nc"');
  });

  it('previews a text table, transposes and drops empty rows', () => {
    expect(csvTextTable('a,b\n1,2')).toBe('a | b\n--+--\n1 | 2');
    expect(transposeCsv('a,b\n1,2')).toBe('a,1\nb,2');
    expect(deleteEmptyRows('a,b\n\n1,2')).toBe('a,b\n1,2');
    expect(deleteEmptyRows('a,b\n , \n1,2')).toBe('a,b\n1,2');
  });

  it('rejects an unclosed quote', () => {
    expect(() => csvEditor('"open')).toThrow(ToolInputError);
  });

  it('runs the meta examples', () => {
    for (const example of meta.examples ?? []) expect(csvEditor(example.input)).toContain(example.expect);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(csvEditor, { malformed: ['"unterminated', '"'] });
  });
});
