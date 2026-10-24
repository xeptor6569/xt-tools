import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'string-escaper',
  name: 'String escaper',
  description:
    'Escape and unescape strings for JSON, JavaScript, C, SQL, shell, PowerShell, regular expressions, CSV and XML.',
  category: 'development',
  keywords: [
    'escape',
    'unescape',
    'string',
    'json',
    'javascript',
    'sql',
    'shell',
    'bash',
    'powershell',
    'regex',
    'csv',
    'xml',
    'html entities',
    'quote',
    'backslash',
  ],
  added: '2026-10-24',
  examples: [{ input: 'He said "hi"', expect: 'He said \\"hi\\"' }],
};

export default meta;
