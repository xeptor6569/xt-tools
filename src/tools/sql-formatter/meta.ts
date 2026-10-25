import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'sql-formatter',
  name: 'SQL formatter',
  description:
    'Format and indent SQL for PostgreSQL, MySQL, SQLite, SQL Server, Oracle and 15 other dialects, with keyword case options.',
  category: 'development',
  group: 'formatters',
  keywords: [
    'sql',
    'format',
    'beautify',
    'prettify',
    'postgresql',
    'mysql',
    'sqlite',
    't-sql',
    'query',
    'oracle',
    'pl/sql',
    'bigquery',
    'snowflake',
    'pretty print',
  ],
  tags: ['sql', 'format'],
  added: '2026-10-24',
  heavy: true,
  examples: [
    { input: 'select id,name from users where id=1', expect: 'SELECT\n  id,\n  name\nFROM\n  users' },
    {
      input: 'select count(*) as n from orders o join users u on u.id=o.user_id group by u.id',
      expect: '  JOIN users u ON u.id = o.user_id',
    },
  ],
};

export default meta;
