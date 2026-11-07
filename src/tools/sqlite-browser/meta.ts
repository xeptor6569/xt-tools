import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'sqlite-browser',
  name: 'SQLite browser',
  description: 'Inspect SQLite databases and run SQL queries in WebAssembly with sql.js.',
  category: 'development',
  group: 'utilities',
  keywords: ['sqlite', 'sql', 'database', 'query', 'table', 'schema', 'wasm', 'sqljs'],
  tags: ['sqlite', 'sql', 'database'],
  added: '2026-11-06',
  heavy: true,
  examples: [
    {
      input:
        "CREATE TABLE items (name TEXT, qty INT);\nINSERT INTO items VALUES ('apple', 3), ('pear', 5);\nSELECT name, qty FROM items ORDER BY qty DESC;",
      expect: '"name": "pear"',
    },
  ],
};

export default meta;
