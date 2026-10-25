import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { rows } from './data.ts';
import { portReference } from './logic.ts';

describe('portReference', () => {
  it('lists a broad set of common services', () => {
    expect(rows.length).toBeGreaterThanOrEqual(80);
    const groups = new Set(rows.map((row) => row.group));
    for (const group of ['Web', 'Mail', 'Name', 'Remote', 'Database', 'VPN']) {
      expect(groups.has(group), group).toBe(true);
    }
  });

  it('has unique ports and finished descriptions', () => {
    const keys = rows.map((row) => row.port);
    expect(new Set(keys).size).toBe(keys.length);
    for (const row of rows) {
      expect(row.port).toMatch(/^\d+$/);
      expect(row.protocol).toMatch(/^(TCP|UDP|TCP\/UDP)$/);
      expect(row.description.endsWith('.')).toBe(true);
      expect(Object.values(row).join(' ')).not.toMatch(/https?:/);
    }
  });

  it('returns everything for an empty query and filters by every term', () => {
    expect(portReference(rows, '')).toHaveLength(rows.length);
    expect(portReference(rows, '443').map((row) => row.service)).toContain('HTTPS');
    expect(portReference(rows, 'ssh').map((row) => row.port)).toEqual(['22']);
    expect(portReference(rows, 'database mysql').map((row) => row.port)).toEqual(['3306']);
  });

  it('survives empty, huge and malformed queries', () => {
    expectRobust((query) => portReference(rows, query));
  });
});
