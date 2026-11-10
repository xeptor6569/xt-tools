import { describe, expect, it } from 'vitest';
import { expectRobustAsync } from '../../../tests/helpers/expect-robust.ts';
import { createSampleSqliteDb, runSqlite, sqliteBrowser } from './logic.ts';

describe('sqliteBrowser', () => {
  it('runs DDL, DML and SELECT queries in SQLite WASM', async () => {
    const out = await sqliteBrowser(
      "CREATE TABLE items (name TEXT, qty INT);\nINSERT INTO items VALUES ('apple', 3), ('pear', 5);\nSELECT name, qty FROM items ORDER BY qty DESC;",
    );
    expect(JSON.parse(out)).toEqual([
      { name: 'pear', qty: 5 },
      { name: 'apple', qty: 3 },
    ]);
  });

  it('opens a binary SQLite 3 database, inspects tables and formats CSV', async () => {
    const dbBytes = await createSampleSqliteDb();
    expect(new TextDecoder('latin1').decode(dbBytes.subarray(0, 15))).toBe('SQLite format 3');

    const res = await runSqlite('SELECT name, price FROM products ORDER BY price DESC LIMIT 2;', {
      dbBytes,
      format: 'csv',
    });
    expect(res.tables.map((t) => t.name)).toEqual(['orders', 'products']);
    expect(res.text).toBe('name,price\n27-inch Monitor,319.99\nMechanical Keyboard,129');
  });

  it('rejects non-SQLite binary files', async () => {
    await expect(runSqlite('SELECT 1;', { dbBytes: new Uint8Array(32).fill(1) })).rejects.toThrow(/SQLite format 3/);
  });

  it('survives empty, huge and malformed input', async () => {
    await expectRobustAsync((input) => sqliteBrowser(input), { timeLimitMs: 5000 });
  });
});
