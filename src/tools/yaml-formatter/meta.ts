import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'yaml-formatter',
  name: 'YAML formatter',
  description:
    'Format and validate YAML streams, keeping comments, with indentation, key sorting, quoting and line width options.',
  category: 'development',
  keywords: ['yaml', 'yml', 'format', 'prettify', 'validate', 'lint', 'indent', 'sort keys', 'multi-document'],
  added: '2026-10-24',
  examples: [
    { input: 'a:   1\nb:    [1,   2]', expect: 'b: [1, 2]' },
    { input: 'name: demo\nitems:\n- one   # first\n- two\n---\nnext: doc', expect: '  - one # first' },
  ],
};

export default meta;
