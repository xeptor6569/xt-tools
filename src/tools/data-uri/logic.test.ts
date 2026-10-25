import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { dataUri } from './logic.ts';
import meta from './meta.ts';

describe('dataUri', () => {
  it('encodes text and decodes that data URI back', () => {
    expect(dataUri('hello')).toBe('data:text/plain;charset=utf-8,hello');
    expect(dataUri('hello world')).toBe('data:text/plain;charset=utf-8,hello%20world');
    expect(dataUri('data:text/plain;charset=utf-8,hello%20world')).toBe('hello world');
  });

  it('decodes a base64 data URI', () => {
    expect(dataUri('data:text/plain;base64,aGVsbG8=')).toBe('hello');
  });

  it('rejects a broken data URI', () => {
    expect(() => dataUri('data:text/plain')).toThrow(ToolInputError);
    expect(() => dataUri('data:text/plain;base64,!!!!')).toThrow(ToolInputError);
    expect(dataUri('')).toBe('');
  });

  it('matches the published example', () => {
    for (const example of meta.examples ?? []) expect(dataUri(example.input)).toContain(example.expect);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(dataUri);
  });
});
