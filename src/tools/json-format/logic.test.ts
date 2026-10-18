import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { jsonFormat } from './logic.ts';

describe('jsonFormat', () => {
  it('pretty-prints with two spaces by default', () => {
    expect(jsonFormat('{"a":1,"b":[true,null]}').text).toBe('{\n  "a": 1,\n  "b": [\n    true,\n    null\n  ]\n}');
  });

  it('supports four spaces, tabs and minify', () => {
    expect(jsonFormat('{"a":1}', { indent: '4' }).text).toBe('{\n    "a": 1\n}');
    expect(jsonFormat('{"a":1}', { indent: 'tab' }).text).toBe('{\n\t"a": 1\n}');
    expect(jsonFormat('{ "a" : [ 1 , 2 ] }', { indent: 'minify' }).text).toBe('{"a":[1,2]}');
  });

  it('sorts keys recursively', () => {
    expect(jsonFormat('{"b":{"d":1,"c":2},"a":[{"z":0,"y":1}]}', { sortKeys: true, indent: 'minify' }).text).toBe(
      '{"a":[{"y":1,"z":0}],"b":{"c":2,"d":1}}',
    );
  });

  it('keeps big integers and precise decimals exactly', () => {
    const input = '{"id":12345678901234567890,"price":0.10000000000000000001,"n":1.5,"e":1e3}';
    const { text, warnings } = jsonFormat(input, { indent: 'minify' });
    expect(text).toBe('{"id":12345678901234567890,"price":0.10000000000000000001,"n":1.5,"e":1e3}');
    expect(warnings).toEqual([]);
  });

  it('keeps unicode and escapes valid', () => {
    expect(jsonFormat('"\\u00e9 \\ud83d\\ude80"').text).toBe('"é 🚀"');
  });

  it('returns nothing for empty input', () => {
    expect(jsonFormat('  \n').text).toBe('');
  });

  it('reports invalid JSON', () => {
    expect(() => jsonFormat('{"a":}')).toThrow(ToolInputError);
    expect(() => jsonFormat("{'a': 1}")).toThrow(/Invalid JSON/);
    expect(() => jsonFormat('[1,]')).toThrow(ToolInputError);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(jsonFormat, { malformed: ['['.repeat(100_000), '{"a":' + '1'.repeat(10_000) + '}', '"\\uD800"'] });
  });
});
