import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { safeLinksDecoder } from './logic.ts';
import meta from './meta.ts';

const LINK = 'https://eur01.safelinks.protection.outlook.com/?url=https%3A%2F%2Fexample.com%2Fa&data=05';

describe('safeLinksDecoder', () => {
  it('unwraps an Outlook Safe Links URL', () => {
    expect(safeLinksDecoder(LINK)).toBe('https://example.com/a');
  });

  it('unwraps a link inside a sentence and leaves other URLs', () => {
    expect(safeLinksDecoder(`see ${LINK}. thanks`)).toBe('see https://example.com/a. thanks');
    expect(safeLinksDecoder('https://example.com/a')).toBe('https://example.com/a');
    expect(safeLinksDecoder('https://safelinks.protection.outlook.com.evil.com/?url=https%3A%2F%2Fexample.com')).toBe(
      'https://safelinks.protection.outlook.com.evil.com/?url=https%3A%2F%2Fexample.com',
    );
    expect(safeLinksDecoder('https://notsafelinks.protection.outlook.com/?url=https%3A%2F%2Fexample.com')).toBe(
      'https://notsafelinks.protection.outlook.com/?url=https%3A%2F%2Fexample.com',
    );
    expect(safeLinksDecoder('http://eur01.safelinks.protection.outlook.com/?url=https%3A%2F%2Fexample.com')).toBe(
      'http://eur01.safelinks.protection.outlook.com/?url=https%3A%2F%2Fexample.com',
    );
  });

  it('rejects a Safe Links URL that has no url parameter', () => {
    expect(() => safeLinksDecoder('https://eur01.safelinks.protection.outlook.com/?data=05')).toThrow(ToolInputError);
  });

  it('matches the published example', () => {
    for (const example of meta.examples ?? []) expect(safeLinksDecoder(example.input)).toContain(example.expect);
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(safeLinksDecoder);
  });
});
