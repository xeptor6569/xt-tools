import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'password-vault-merge',
  name: 'Password vault merge',
  description: 'Merge Bitwarden, Apple Passwords, Chrome and other exports into one local Bitwarden file.',
  category: 'privacy',
  keywords: ['bitwarden', 'icloud', 'chrome', 'google', 'merge', 'dedupe', 'safari', 'firefox', '1password', 'keepass'],
  tags: ['password', 'vault', 'merge', 'bitwarden'],
  added: '2026-11-10',
  sensitive: true,
  heavy: true,
  examples: [
    {
      input: [
        'folder,favorite,type,name,notes,fields,reprompt,login_uri,login_username,login_password,login_totp',
        ',1,login,Example,Work,,0,https://www.example.com/login,alice,correct-horse,',
        '---',
        'Title,URL,Username,Password,Notes,OTPAuth',
        'Example,https://example.com/login,alice,correct-horse,From Apple,GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ',
      ].join('\n'),
      expect: 'folded: 1',
    },
  ],
};

export default meta;
