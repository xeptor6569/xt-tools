import { describe, expect, it } from 'vitest';
import { highlight, searchTools, type SearchDocument } from './search.ts';

const docs: SearchDocument[] = [
  {
    id: 'slugify',
    name: 'Slugify',
    description: 'Turn any text into a clean, URL-friendly slug.',
    category: 'web',
    categoryLabel: 'Web',
    keywords: ['slug', 'url', 'permalink', 'kebab case'],
    tags: ['url', 'slug'],
  },
  {
    id: 'password-generator',
    name: 'Password generator',
    description: 'Generate a random password or an EFF Diceware passphrase in this browser.',
    category: 'crypto',
    categoryLabel: 'Crypto',
    keywords: ['password', 'diceware'],
    tags: ['password', 'passphrase'],
  },
  {
    id: 'password-strength',
    name: 'Password strength',
    description: 'Score a password with zxcvbn.',
    category: 'crypto',
    categoryLabel: 'Crypto',
    keywords: ['zxcvbn', 'entropy'],
    tags: ['password', 'security'],
  },
  {
    id: 'bcrypt',
    name: 'Bcrypt',
    description: 'Hash and compare passwords with bcrypt.',
    category: 'crypto',
    categoryLabel: 'Crypto',
    keywords: ['bcrypt', 'kdf'],
    tags: ['password', 'hash'],
  },
  {
    id: 'hash-text',
    name: 'Hash text',
    description: 'Hash text with SHA-256 and other algorithms.',
    category: 'crypto',
    categoryLabel: 'Crypto',
    keywords: ['sha256', 'blake3', 'checksum'],
    tags: ['hash', 'checksum'],
  },
  {
    id: 'date-difference',
    name: 'Date difference',
    description: 'Count calendar and business days between two dates.',
    category: 'math',
    categoryLabel: 'Math',
    keywords: ['business days', 'calendar'],
    tags: ['date', 'time'],
  },
  {
    id: 'json-format',
    name: 'JSON formatter',
    description: 'Pretty-print JSON.',
    category: 'development',
    categoryLabel: 'Development',
    groupLabel: 'Formatters',
    keywords: ['prettify'],
    tags: ['json', 'format'],
  },
  {
    id: 'data-format-converter',
    name: 'Data format converter',
    description: 'Convert JSON, YAML, TOML and XML.',
    category: 'converter',
    categoryLabel: 'Converter',
    keywords: ['json', 'yaml', 'toml'],
    tags: ['json', 'yaml'],
  },
  {
    id: 'url-encoder',
    name: 'URL encoder',
    description: 'Percent-encode and decode a URL.',
    category: 'web',
    categoryLabel: 'Web',
    keywords: ['percent', 'uri'],
    tags: ['url', 'encoding'],
  },
];

describe('searchTools', () => {
  it('ranks an exact title above a tag or keyword', () => {
    expect(searchTools(docs, 'slugify').hits[0]?.id).toBe('slugify');
    expect(
      searchTools(docs, 'password')
        .hits.map((hit) => hit.id)
        .slice(0, 2),
    ).toEqual(['password-generator', 'password-strength']);
  });

  it('matches keywords, tags and the description', () => {
    expect(searchTools(docs, 'permalink').hits.map((hit) => hit.id)).toEqual(['slugify']);
    expect(searchTools(docs, 'sha256').hits[0]?.id).toBe('hash-text');
    expect(searchTools(docs, 'url-friendly').hits[0]?.id).toBe('slugify');
    expect(searchTools(docs, 'business days').hits.map((hit) => hit.id)).toEqual(['date-difference']);
  });

  it('requires every word and still forgives a typo in a longer word', () => {
    expect(searchTools(docs, 'json violin').hits).toEqual([]);
    expect(searchTools(docs, 'json yaml').hits[0]?.id).toBe('data-format-converter');
    expect(searchTools(docs, 'passwrod').hits.map((hit) => hit.id)).toContain('password-generator');
    expect(searchTools(docs, 'sluggify').hits[0]?.id).toBe('slugify');
  });

  it('returns nothing for a blank query and reports how many matched', () => {
    expect(searchTools(docs, '   ')).toEqual({ hits: [], total: 0 });
    const many = Array.from({ length: 10 }, (_, index) => ({
      id: `hash-${index}`,
      name: `Hash ${index}`,
      description: 'Hashes a value for the catalog test case.',
      category: 'crypto',
      categoryLabel: 'Crypto',
      keywords: ['digest'],
      tags: ['hash'],
    }));
    const result = searchTools(many, 'hash');
    expect(result.total).toBe(10);
    expect(result.hits).toHaveLength(8);
  });

  it('does not fuzzy-match a short query into unrelated tools', () => {
    expect(searchTools(docs, 'ip').hits).toEqual([]);
  });
});

describe('highlight', () => {
  it('marks each query word without changing the surrounding text', () => {
    expect(highlight('URL-friendly slug', 'url friendly')).toEqual([
      { text: 'URL', match: true },
      { text: '-', match: false },
      { text: 'friendly', match: true },
      { text: ' slug', match: false },
    ]);
    expect(highlight('Slugify', '   ')).toEqual([{ text: 'Slugify', match: false }]);
  });
});
