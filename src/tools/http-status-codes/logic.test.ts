import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { rows } from './data.ts';
import { httpStatusCodes } from './logic.ts';

describe('httpStatusCodes', () => {
  it('includes the common codes and a faithful 1xx–5xx set', () => {
    expect(rows.length).toBeGreaterThanOrEqual(40);
    const codes = new Set(rows.map((row) => row.value));
    for (const code of [
      '100',
      '200',
      '201',
      '204',
      '301',
      '302',
      '304',
      '400',
      '401',
      '403',
      '404',
      '418',
      '500',
      '503',
    ]) {
      expect(codes.has(code)).toBe(true);
    }
    expect(rows.find((row) => row.value === '404')?.name).toBe('Not Found');
    expect(rows.find((row) => row.value === '418')?.name).toBe('Unused');
  });

  it('returns everything for an empty query', () => {
    expect(httpStatusCodes(rows, '')).toHaveLength(rows.length);
  });

  it('matches every term, ignoring case', () => {
    expect(httpStatusCodes(rows, 'not found').map((row) => row.value)).toEqual(['404']);
    expect(httpStatusCodes(rows, '418 unused').map((row) => row.value)).toEqual(['418']);
  });

  it('survives empty, huge and malformed queries', () => {
    expectRobust((query) => httpStatusCodes(rows, query));
  });
});
