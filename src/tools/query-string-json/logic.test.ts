import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { queryStringJson } from './logic.ts';
import meta from './meta.ts';

describe('queryStringJson', () => {
  it('converts a query string to JSON and back', () => {
    expect(queryStringJson('a=1&b=2')).toBe('{"a":"1","b":"2"}');
    expect(queryStringJson('{"a":"1","b":"2"}')).toBe('a=1&b=2');
  });

  it('turns repeated keys into an array and decodes plus as space', () => {
    expect(queryStringJson('a=1&a=2')).toBe('{"a":["1","2"]}');
    expect(queryStringJson('{"a":["1","2"]}')).toBe('a=1&a=2');
    expect(queryStringJson('q=hello+world')).toBe('{"q":"hello world"}');
  });

  it('rejects JSON that is not an object', () => {
    expect(() => queryStringJson('[1]')).toThrow(ToolInputError);
    expect(() => queryStringJson('{')).toThrow(ToolInputError);
    expect(queryStringJson('')).toBe('');
  });

  it('matches the published example', () => {
    for (const example of meta.examples ?? []) expect(queryStringJson(example.input)).toContain(example.expect);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(queryStringJson);
  });
});
