import { describe, expect, it } from 'vitest';
import { createSearcher, type SearchEntry } from './search.ts';

const entries: SearchEntry[] = [
  {
    id: 'slugify',
    name: 'Slugify',
    description: 'Turn any text into a clean, URL-friendly slug.',
    category: 'web',
    categoryLabel: 'Web',
    keywords: ['slug', 'url', 'permalink'],
    added: '2026-10-14',
  },
  {
    id: 'uuid-generator',
    name: 'UUID generator',
    description: 'Generate random UUIDs.',
    category: 'crypto',
    categoryLabel: 'Crypto',
    keywords: ['uuid', 'guid'],
    added: '2026-10-18',
  },
  {
    id: 'gitignore-generator',
    name: '.gitignore generator',
    description: 'Build a .gitignore file from templates.',
    category: 'development',
    categoryLabel: 'Development',
    keywords: ['gitignore', 'git', 'ignore', 'template', 'github'],
    added: '2026-10-24',
  },
];

describe('createSearcher', () => {
  const search = createSearcher(entries);

  it('matches a keyword that is not in the name', () => {
    expect(search('permalink').map((entry) => entry.id)).toEqual(['slugify']);
  });

  it('returns nothing for a blank query', () => {
    expect(search('   ')).toEqual([]);
  });

  it('matches a single character against the name and keywords', () => {
    expect(search('y').map((entry) => entry.id)).toEqual(['slugify']);
  });
});
