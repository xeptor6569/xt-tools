import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'chmod-calculator',
  name: 'Chmod calculator',
  description:
    'Convert Unix file permissions between octal, symbolic and chmod notation, with a checkbox grid and umask.',
  category: 'development',
  group: 'utilities',
  keywords: [
    'chmod',
    'permissions',
    'unix',
    'linux',
    'octal',
    'rwx',
    'umask',
    'file mode',
    'setuid',
    'setgid',
    'sticky bit',
  ],
  tags: ['permissions', 'unix'],
  added: '2026-10-24',
  examples: [
    { input: '755', expect: 'rwxr-xr-x' },
    { input: '-rw-r--r--', expect: 'chmod 644 file' },
    { input: 'u=rwx,g=rx,o=', expect: 'chmod 750 file' },
  ],
};

export default meta;
