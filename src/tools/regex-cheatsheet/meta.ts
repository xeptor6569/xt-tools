import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'regex-cheatsheet',
  name: 'Regex cheatsheet',
  description:
    'Searchable reference of regular expression syntax: character classes, anchors, groups, lookarounds and flags.',
  category: 'development',
  group: 'cheatsheets',
  keywords: [
    'regex',
    'regexp',
    'regular expression',
    'cheatsheet',
    'pattern',
    'lookahead',
    'lookbehind',
    'pcre',
    'reference',
  ],
  added: '2026-10-24',
  examples: [{ input: 'lookbehind', expect: '(?<=abc)' }],
};

export default meta;
