import { faker } from '@faker-js/faker/locale/en';
import { describe, expect, it } from 'vitest';
import { parseCsv } from '../../lib/csv.ts';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { FIELD_TYPES } from './fields.ts';
import {
  formatTable,
  generateRows,
  MAX_ROWS,
  mockData,
  parseCount,
  parseSeed,
  quoteIdentifier,
  parseRefDate,
  sqlLiteral,
  sqlTableName,
  toCsv,
  toJson,
  toNdjson,
  toSql,
  type FieldSpec,
  type MockRequest,
  type Table,
} from './logic.ts';

const SEEDED_REF_DATE = '2026-01-01T00:00:00.000Z';

const DEFAULT_FIELDS: FieldSpec[] = [
  { name: 'id', type: 'uuid' },
  { name: 'firstName', type: 'firstName' },
  { name: 'lastName', type: 'lastName' },
  { name: 'email', type: 'email' },
  { name: 'city', type: 'city' },
  { name: 'country', type: 'country' },
  { name: 'createdAt', type: 'datePast' },
];

const request = (over: Partial<MockRequest> = {}): MockRequest => ({
  fields: DEFAULT_FIELDS,
  count: '3',
  seed: 42,
  refDate: '2026-01-01',
  format: 'json',
  sql: { table: 'users', quote: 'ansi', batch: 1 },
  ...over,
});

/** A table exercising every formatter edge case. */
const TRICKY: Table = {
  columns: ['id', 'name', 'note', 'ok', 'score'],
  rows: [
    [1, "O'Brien", 'say "hi", then\nleave', true, 1.5],
    [2, 'Zoë 日本 🚀', null, false, null],
    [3, 'back\\slash', ' padded ', null, -0.25],
  ],
};

describe('parseCount', () => {
  it('accepts 1 to 10,000 with surrounding spaces', () => {
    expect(parseCount('1')).toBe(1);
    expect(parseCount(' 250 ')).toBe(250);
    expect(parseCount(String(MAX_ROWS))).toBe(MAX_ROWS);
  });

  it('rejects zero, too many, decimals, signs and words', () => {
    for (const bad of ['0', '10001', '999999', '1.5', '-1', '+3', '1e3', 'hello', '', '١٢']) {
      expect(() => parseCount(bad), bad).toThrow(/rows/);
    }
  });
});

describe('parseSeed', () => {
  it('returns undefined for an empty seed and uses unsigned 32-bit numbers as is', () => {
    expect(parseSeed('  ')).toBeUndefined();
    expect(parseSeed('42')).toBe(42);
    expect(parseSeed('4294967295')).toBe(4294967295);
  });

  it('hashes other text with FNV-1a', () => {
    // Published FNV-1a 32-bit vectors.
    expect(parseSeed('a')).toBe(0xe40c292c);
    expect(parseSeed('foobar')).toBe(0xbf9cf968);
    expect(parseSeed('4294967296')).not.toBe(4294967296);
    expect(parseSeed('héllo')).toBe(parseSeed(' héllo '));
  });
});

describe('parseRefDate', () => {
  it('accepts real calendar days', () => {
    expect(parseRefDate('2026-10-24')).toBe('2026-10-24T00:00:00.000Z');
    expect(parseRefDate(' 2024-02-29 ')).toBe('2024-02-29T00:00:00.000Z');
  });

  it('rejects other formats and impossible days', () => {
    for (const bad of ['', '2026-1-1', '2025-02-29', '2026-13-01', '24/10/2026', 'today'])
      expect(() => parseRefDate(bad), bad).toThrow(/YYYY-MM-DD/);
  });
});

describe('generateRows', () => {
  it('is deterministic for a seed and reference date', () => {
    const a = generateRows(faker, DEFAULT_FIELDS, 20, 7, SEEDED_REF_DATE);
    const b = generateRows(faker, DEFAULT_FIELDS, 20, 7, SEEDED_REF_DATE);
    const c = generateRows(faker, DEFAULT_FIELDS, 20, 8, SEEDED_REF_DATE);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    expect(a.columns).toEqual(DEFAULT_FIELDS.map((f) => f.name));
  });

  it('produces values of the expected shape', () => {
    const { rows } = generateRows(faker, DEFAULT_FIELDS, 50, 1, SEEDED_REF_DATE);
    for (const [id, first, last, email, city, country, createdAt] of rows) {
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      for (const v of [first, last, city, country]) expect(typeof v === 'string' && v.length > 0).toBe(true);
      expect(email).toMatch(/^[^@\s]+@[^@\s]+\.[a-z]+$/i);
      expect(typeof createdAt).toBe('string');
      const t = Date.parse(createdAt as string);
      expect(t).toBeLessThanOrEqual(Date.parse(SEEDED_REF_DATE));
      expect(t).toBeGreaterThanOrEqual(Date.parse(SEEDED_REF_DATE) - 366 * 86_400_000);
    }
  });

  it('honours integer, decimal, boolean, sequence and length parameters', () => {
    const fields: FieldSpec[] = [
      { name: 'n', type: 'sequence', params: { start: '100' } },
      { name: 'i', type: 'int', params: { min: '-3', max: '3' } },
      { name: 'f', type: 'float', params: { min: '0', max: '1', decimals: '1' } },
      { name: 'b', type: 'boolean', params: { probability: '100' } },
      { name: 's', type: 'alphanumeric', params: { length: '5' } },
      { name: 'd', type: 'numeric', params: { length: '4' } },
    ];
    const { rows } = generateRows(faker, fields, 200, 3, SEEDED_REF_DATE);
    rows.forEach(([n, i, f, b, s, d], r) => {
      expect(n).toBe(100 + r);
      expect(Number.isInteger(i) && (i as number) >= -3 && (i as number) <= 3).toBe(true);
      expect(f as number).toBeGreaterThanOrEqual(0);
      expect(f as number).toBeLessThanOrEqual(1);
      expect(String(f)).toMatch(/^\d(\.\d)?$/);
      expect(b).toBe(true);
      expect(s).toMatch(/^[a-z0-9]{5}$/i);
      expect(d).toMatch(/^\d{4}$/);
    });
  });

  it('leaves the requested share of values empty', () => {
    const rows = generateRows(faker, [{ name: 'x', type: 'word', empty: '30' }], 2000, 9, SEEDED_REF_DATE).rows;
    const nulls = rows.filter(([v]) => v === null).length;
    expect(nulls).toBeGreaterThan(450);
    expect(nulls).toBeLessThan(750);
    const all = generateRows(faker, [{ name: 'x', type: 'word', empty: '100' }], 10, 9, SEEDED_REF_DATE).rows;
    expect(all.every(([v]) => v === null)).toBe(true);
  });

  it('generates every field type with its default parameters', () => {
    for (let start = 0; start < FIELD_TYPES.length; start += 50) {
      const types = FIELD_TYPES.slice(start, start + 50);
      const { rows } = generateRows(
        faker,
        types.map((t) => ({ name: t.id, type: t.id })),
        20,
        11,
        SEEDED_REF_DATE,
      );
      for (const row of rows)
        row.forEach((v, i) => {
          expect(['string', 'number', 'boolean'], types[i]!.id).toContain(typeof v);
          // No generator may produce links to other sites. (A crawler user agent quotes its info page.)
          if (types[i]!.id !== 'userAgent') expect(String(v), types[i]!.id).not.toMatch(/https?:\/\//);
        });
    }
  });

  it('rejects bad field definitions with helpful messages', () => {
    const gen = (fields: FieldSpec[]) => () => generateRows(faker, fields, 1, 1, SEEDED_REF_DATE);
    expect(gen([])).toThrow(/at least one field/);
    expect(gen([{ name: ' ', type: 'uuid' }])).toThrow(/Field 1 needs a name/);
    expect(
      gen([
        { name: 'a', type: 'uuid' },
        { name: 'a', type: 'city' },
      ]),
    ).toThrow(/unique/);
    expect(gen([{ name: 'a', type: 'image' }])).toThrow(/unknown field type/);
    expect(gen([{ name: 'a\nb', type: 'uuid' }])).toThrow(/control characters/);
    expect(gen([{ name: 'x'.repeat(65), type: 'uuid' }])).toThrow(/64 characters/);
    expect(gen([{ name: 'a', type: 'int', params: { min: 'ten' } }])).toThrow(/must be a number/);
    expect(gen([{ name: 'a', type: 'int', params: { min: '1.5' } }])).toThrow(/whole number/);
    expect(gen([{ name: 'a', type: 'int', params: { min: '5', max: '1' } }])).toThrow(/minimum is larger/);
    expect(gen([{ name: 'a', type: 'alphanumeric', params: { length: '0' } }])).toThrow(/from 1 to 256/);
    expect(gen([{ name: 'a', type: 'uuid', empty: '101' }])).toThrow(/Empty %/);
    expect(gen(Array.from({ length: 51 }, (_, i) => ({ name: `f${i}`, type: 'uuid' })))).toThrow(/at most 50/);
    expect(() => generateRows(faker, DEFAULT_FIELDS, 1, 1, 'not a date')).toThrow(/reference date/);
  });
});

describe('formatters', () => {
  it('writes pretty JSON with nulls and native types', () => {
    const out = toJson({ columns: ['a', 'b'], rows: [[1, null]] });
    expect(out).toBe('[\n  {\n    "a": 1,\n    "b": null\n  }\n]');
    expect(JSON.parse(toJson(TRICKY))).toEqual([
      { id: 1, name: "O'Brien", note: 'say "hi", then\nleave', ok: true, score: 1.5 },
      { id: 2, name: 'Zoë 日本 🚀', note: null, ok: false, score: null },
      { id: 3, name: 'back\\slash', note: ' padded ', ok: null, score: -0.25 },
    ]);
  });

  it('keeps a "__proto__" column as data', () => {
    const [row] = JSON.parse(toJson({ columns: ['__proto__'], rows: [['x']] })) as Array<Record<string, unknown>>;
    expect(Object.keys(row!)).toEqual(['__proto__']);
  });

  it('writes one JSON object per line for NDJSON', () => {
    expect(toNdjson(TRICKY).split('\n')).toEqual([
      '{"id":1,"name":"O\'Brien","note":"say \\"hi\\", then\\nleave","ok":true,"score":1.5}',
      '{"id":2,"name":"Zoë 日本 🚀","note":null,"ok":false,"score":null}',
      '{"id":3,"name":"back\\\\slash","note":" padded ","ok":null,"score":-0.25}',
    ]);
  });

  it('writes RFC 4180 CSV with quoting and empty cells for nulls', () => {
    const csv = toCsv(TRICKY);
    expect(csv).toBe(
      [
        'id,name,note,ok,score',
        `1,O'Brien,"say ""hi"", then\nleave",true,1.5`,
        '2,Zoë 日本 🚀,,false,',
        '3,back\\slash," padded ",,-0.25',
      ].join('\n'),
    );
    expect(parseCsv(csv, ',')[1]).toEqual(['1', "O'Brien", 'say "hi", then\nleave', 'true', '1.5']);
  });

  it('quotes identifiers for each SQL dialect', () => {
    expect(quoteIdentifier('a"b', 'ansi')).toBe('"a""b"');
    expect(quoteIdentifier('a`b', 'mysql')).toBe('`a``b`');
    expect(quoteIdentifier('a]b', 'mssql')).toBe('[a]]b]');
    expect(sqlTableName(' app.user list ', 'ansi')).toBe('"app"."user list"');
    expect(() => sqlTableName('', 'ansi')).toThrow(/table name/);
    expect(() => sqlTableName('a..b', 'ansi')).toThrow(/empty part/);
  });

  it('writes SQL literals with escaping, NULL and dialect booleans', () => {
    expect(sqlLiteral("O'Brien", 'ansi')).toBe("'O''Brien'");
    expect(sqlLiteral('a\\b', 'ansi')).toBe("'a\\b'");
    expect(sqlLiteral("a\\'b", 'mysql')).toBe("'a\\\\''b'");
    expect(sqlLiteral('Zoë', 'mssql')).toBe("N'Zoë'");
    expect(sqlLiteral('plain', 'mssql')).toBe("'plain'");
    expect(sqlLiteral(null, 'ansi')).toBe('NULL');
    expect(sqlLiteral(true, 'ansi')).toBe('TRUE');
    expect(sqlLiteral(false, 'mssql')).toBe('0');
    expect(sqlLiteral(-0.25, 'ansi')).toBe('-0.25');
    expect(sqlLiteral(Number.NaN, 'ansi')).toBe('NULL');
  });

  it('writes one INSERT per row or batches rows', () => {
    const single = toSql(TRICKY, { table: 'people', quote: 'ansi', batch: 1 });
    expect(single.split('\n')[0]).toBe(
      `INSERT INTO "people" ("id", "name", "note", "ok", "score") VALUES (1, 'O''Brien', 'say "hi", then`,
    );
    expect(single).toContain(`VALUES (2, 'Zoë 日本 🚀', NULL, FALSE, NULL);`);
    expect(single.match(/^INSERT/gm)).toHaveLength(3);
    const batched = toSql(TRICKY, { table: 'people', quote: 'mysql', batch: 2 });
    expect(batched).toBe(
      [
        'INSERT INTO `people` (`id`, `name`, `note`, `ok`, `score`) VALUES',
        `  (1, 'O''Brien', 'say "hi", then\nleave', TRUE, 1.5),`,
        `  (2, 'Zoë 日本 🚀', NULL, FALSE, NULL);`,
        "INSERT INTO `people` (`id`, `name`, `note`, `ok`, `score`) VALUES (3, 'back\\\\slash', ' padded ', NULL, -0.25);",
      ].join('\n'),
    );
  });

  it('dispatches on the format', () => {
    const sql = { table: 't', quote: 'ansi', batch: 1 } as const;
    expect(formatTable(TRICKY, 'json', sql)).toBe(toJson(TRICKY));
    expect(formatTable(TRICKY, 'ndjson', sql)).toBe(toNdjson(TRICKY));
    expect(formatTable(TRICKY, 'csv', sql)).toBe(toCsv(TRICKY));
    expect(formatTable(TRICKY, 'sql', sql)).toBe(toSql(TRICKY, sql));
  });
});

describe('mockData', () => {
  it('generates the requested number of rows in each format', () => {
    expect(JSON.parse(mockData(faker, request()))).toHaveLength(3);
    expect(mockData(faker, request({ format: 'ndjson' })).split('\n')).toHaveLength(3);
    expect(mockData(faker, request({ format: 'csv' })).split('\n')[0]).toBe(
      'id,firstName,lastName,email,city,country,createdAt',
    );
    expect(mockData(faker, request({ format: 'sql' })).match(/^INSERT INTO "users"/gm)).toHaveLength(3);
  });

  it('gives identical output for the same seed and reference date', () => {
    expect(mockData(faker, request({ count: '25' }))).toBe(mockData(faker, request({ count: '25' })));
    expect(mockData(faker, request({ refDate: '2026-06-01' }))).not.toBe(mockData(faker, request()));
  });

  it('generates 10,000 default rows quickly', () => {
    const start = performance.now();
    const out = mockData(faker, request({ count: '10000', format: 'csv' }));
    expect(out.split('\n')).toHaveLength(10_001);
    expect(performance.now() - start).toBeLessThan(2000);
  });

  it('checks the table name before generating SQL', () => {
    expect(() => mockData(faker, request({ format: 'sql', sql: { table: ' ', quote: 'ansi', batch: 1 } }))).toThrow(
      /table name/,
    );
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust((s) => mockData(faker, request({ count: s })), { malformed: ['10000', '1', '00001'] });
    expectRobust((s) => mockData(faker, request({ fields: [{ name: s, type: 'word' }] })));
    expectRobust((s) => mockData(faker, request({ fields: [{ name: 'x', type: s }] })));
    expectRobust((s) => mockData(faker, request({ fields: [{ name: 'x', type: 'int', params: { max: s } }] })));
    expectRobust((s) => mockData(faker, request({ format: 'sql', sql: { table: s, quote: 'mssql', batch: 100 } })));
    expectRobust((s) => mockData(faker, request({ seed: parseSeed(s) ?? 0 })));
    expectRobust((s) => mockData(faker, request({ refDate: s })), { malformed: ['0000-00-00', '9999-12-31'] });
  });
});
