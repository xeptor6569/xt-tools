import type { ToolMeta } from '../types.ts';

const meta: ToolMeta = {
  id: 'email-normalizer',
  name: 'Email normalizer',
  description:
    'Normalize email addresses by lowercasing them, stripping plus tags and Gmail dots, and removing duplicates.',
  category: 'development',
  keywords: [
    'email',
    'normalize',
    'gmail',
    'plus addressing',
    'dedupe',
    'canonical',
    'address',
    'sub-addressing',
    'punycode',
    'idn',
    'deduplicate',
  ],
  added: '2026-10-24',
  examples: [
    { input: 'John.Doe+news@GoogleMail.com', expect: 'johndoe@gmail.com' },
    { input: 'Jane Doe <Jane@Bücher.de>', expect: 'jane@xn--bcher-kva.de' },
  ],
};

export default meta;
