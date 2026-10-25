import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { httpSnippet } from './logic.ts';
import meta from './meta.ts';

const REQUEST = 'POST https://example.com/api\nContent-Type: application/json\n\n{"ok":true}';

describe('httpSnippet', () => {
  it('turns a text request into fetch, Python and Go', () => {
    const text = httpSnippet(REQUEST);
    expect(text).toContain('fetch("https://example.com/api", {');
    expect(text).toContain('method: "POST"');
    expect(text).toContain('"Content-Type": "application/json"');
    expect(text).toContain('body: "{\\"ok\\":true}"');
    expect(text).toContain('import requests');
    expect(text).toContain('http.NewRequest("POST", "https://example.com/api"');
  });

  it('emits a bare fetch for GET with no headers', () => {
    expect(httpSnippet('GET https://example.com')).toContain('fetch("https://example.com");');
  });

  it('rejects a first line that is not a method and URL', () => {
    expect(() => httpSnippet('hello')).toThrow(ToolInputError);
    expect(httpSnippet('')).toBe('');
  });

  it('matches the published example', () => {
    for (const example of meta.examples ?? []) expect(httpSnippet(example.input)).toContain(example.expect);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(httpSnippet);
  });
});
