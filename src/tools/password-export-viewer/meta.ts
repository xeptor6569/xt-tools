import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'password-export-viewer',
  name: 'Password export viewer',
  description: 'Inspect and convert KeePass KDBX, Bitwarden, 1Password and browser password exports locally.',
  category: 'privacy',
  keywords: [
    'password',
    'vault',
    'keepass',
    'kdbx',
    'bitwarden',
    '1password',
    'chrome',
    'firefox',
    'csv',
    'totp',
    'converter',
    'export',
  ],
  tags: ['password', 'vault', 'keepass', 'converter'],
  added: '2026-11-06',
  sensitive: true,
  heavy: true,
  examples: [
    {
      input: [
        'target: bitwarden-csv',
        'name,url,username,password,note',
        'Example App,https://example.com,alice@example.com,correct-horse,Work account',
      ].join('\n'),
      expect: ',,login,Example App,Work account,,0,https://example.com,alice@example.com,correct-horse,',
    },
    {
      input: [
        'time: 59',
        'folder,favorite,type,name,notes,fields,reprompt,login_uri,login_username,login_password,login_totp',
        'Engineering,1,login,Example App,Prod,,0,https://example.com,alice,s3cret,GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ',
      ].join('\n'),
      expect: '#1 [login] Example App | folder=Engineering | user=alice | url=https://example.com | totp=287082',
    },
  ],
};

export default meta;
