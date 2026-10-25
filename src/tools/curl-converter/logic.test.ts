import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { curlConverter } from './logic.ts';
import meta from './meta.ts';

const POST = `curl https://example.com/api -X POST -H 'Content-Type: application/json' -d '{"ok":true}'`;

describe('curlConverter', () => {
  it('turns a POST into fetch, Python and Go', () => {
    const text = curlConverter(POST);
    expect(text).toContain('fetch("https://example.com/api", {');
    expect(text).toContain('method: "POST"');
    expect(text).toContain('"Content-Type": "application/json"');
    expect(text).toContain('body: "{\\"ok\\":true}"');
    expect(text).toContain('import requests');
    expect(text).toContain('requests.request(');
    expect(text).toContain('package main');
    expect(text).toContain('http.NewRequest("POST", "https://example.com/api"');
    expect(text).toContain('strings.NewReader');
  });

  it('defaults GET, uses POST when there is data, and adds Basic auth', () => {
    expect(curlConverter('curl -s https://example.com')).toContain('fetch("https://example.com");');
    expect(curlConverter('curl https://example.com --data-raw hello')).toContain('method: "POST"');
    expect(curlConverter("curl https://example.com -u 'Aladdin:open sesame'")).toContain(
      'Authorization": "Basic QWxhZGRpbjpvcGVuIHNlc2FtZQ=="',
    );
  });

  it('accepts attached short options and a line continuation', () => {
    const text = curlConverter("curl https://example.com/api \\\n  -XPOST -H 'Accept: text/plain'");
    expect(text).toContain('method: "POST"');
    expect(text).toContain('"Accept": "text/plain"');
  });

  it('does not execute the command and rejects a missing URL', () => {
    expect(() => curlConverter('curl -X POST')).toThrow(ToolInputError);
    expect(() => curlConverter('echo hello')).toThrow(ToolInputError);
    expect(curlConverter('')).toBe('');
  });

  it('matches the published example', () => {
    for (const example of meta.examples ?? []) expect(curlConverter(example.input)).toContain(example.expect);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(curlConverter);
  });
});
