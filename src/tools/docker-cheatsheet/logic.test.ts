import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { rows, SECTIONS } from './data.ts';
import { ALL_SECTIONS, dockerCheatsheet } from './logic.ts';
import meta from './meta.ts';

const commands = (query: string, section?: string) => dockerCheatsheet(rows, query, section).map((r) => r.command);

describe('docker cheatsheet data', () => {
  it('has a useful number of entries', () => {
    expect(rows.length).toBeGreaterThanOrEqual(70);
    expect(rows.length).toBeLessThanOrEqual(220);
  });

  it('has non-empty, trimmed fields in every row', () => {
    for (const row of rows) {
      for (const value of [row.section, row.command, row.description]) {
        expect(value.trim(), JSON.stringify(row)).toBe(value);
        expect(value.length, JSON.stringify(row)).toBeGreaterThan(0);
      }
      expect(row.description, row.command).toMatch(/[.)]$/);
    }
  });

  it('has no duplicate command within a section', () => {
    const keys = rows.map((r) => `${r.section}\u0000${r.command}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('uses only listed sections, and every section has rows', () => {
    const used = new Set(rows.map((r) => r.section));
    for (const s of used) expect(SECTIONS).toContain(s);
    for (const s of SECTIONS) expect(used.has(s), s).toBe(true);
  });

  it('uses Compose v2 and contains no absolute URLs', () => {
    for (const row of rows) {
      expect(row.command).toMatch(/docker /);
      expect(row.command).not.toMatch(/docker-compose/);
      expect(Object.values(row).join(' ')).not.toMatch(/https?:/);
    }
    expect(rows.filter((r) => r.section === 'Compose').every((r) => r.command.startsWith('docker compose '))).toBe(
      true,
    );
  });
});

describe('dockerCheatsheet', () => {
  it('returns everything for an empty query', () => {
    expect(dockerCheatsheet(rows, '')).toHaveLength(rows.length);
  });

  it('finds known commands', () => {
    expect(commands('system prune')[0]).toBe('docker system prune');
    expect(commands('compose down')[0]).toBe('docker compose down');
    expect(commands('multi-platform')).toEqual([
      'docker buildx build --platform linux/amd64,linux/arm64 -t <image> --push .',
    ]);
    expect(commands('password-stdin')).toHaveLength(1);
  });

  it('matches every term in any column, ignoring case', () => {
    expect(commands('FOLLOW logs')).toContain('docker logs -f <container>');
    expect(commands('shell root')).toEqual(['docker exec -it -u root <container> sh']);
    expect(commands('logs zzz-nothing')).toEqual([]);
  });

  it('filters by section', () => {
    const compose = dockerCheatsheet(rows, '', 'Compose');
    expect(compose.length).toBeGreaterThan(10);
    expect(compose.every((r) => r.section === 'Compose')).toBe(true);
    expect(commands('logs', 'Compose')).toEqual(['docker compose logs -f <service>']);
    expect(dockerCheatsheet(rows, '', ALL_SECTIONS)).toHaveLength(rows.length);
    expect(dockerCheatsheet(rows, '', 'No such section')).toEqual([]);
  });

  it('every meta example matches with all sections shown', () => {
    for (const example of meta.examples ?? []) {
      const text = dockerCheatsheet(rows, example.input)
        .map((r) => Object.values(r).join(' '))
        .join('\n');
      expect(text).toContain(example.expect);
    }
  });

  it('survives empty, huge and malformed queries', () => {
    expectRobust((q) => dockerCheatsheet(rows, q));
    expectRobust((q) => dockerCheatsheet(rows, q, 'Images'));
  });
});
