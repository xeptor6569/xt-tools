import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { emailHeaders } from './logic.ts';
import meta from './meta.ts';

describe('emailHeaders', () => {
  it('unfolds a folded header and stops at the body', () => {
    const input = 'Subject: Hello\n world\nFrom: Ada <ada@example.com>\n\nThis is the body';
    expect(emailHeaders(input)).toBe('Subject: Hello world\nFrom: Ada <ada@example.com>');
  });

  it('keeps the continuation whitespace from a tab and accepts CRLF', () => {
    expect(emailHeaders('Subject: Hello\r\n\tworld\r\n')).toBe('Subject: Hello\tworld');
  });

  it('rejects a line that is not a header', () => {
    expect(() => emailHeaders('not a header')).toThrow(ToolInputError);
    expect(emailHeaders('')).toBe('');
  });

  it('matches the published example', () => {
    for (const example of meta.examples ?? []) expect(emailHeaders(example.input)).toContain(example.expect);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(emailHeaders);
  });
});
