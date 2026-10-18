import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'regex-tester',
  name: 'Regex tester',
  description: 'Test JavaScript regular expressions with live highlighting, groups and replace.',
  category: 'development',
  keywords: ['regex', 'regexp', 'regular expression', 'match', 'replace', 'find and replace', 'capture group'],
  examples: [{ input: '\\w+@\\w+', expect: '2 matches' }],
  added: '2026-10-18',
};

export default meta;
