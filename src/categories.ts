// Single source of truth for tool categories. Order here is display order.
// Groups are curated sub-collections. Only categories with enough tools have them;
// a tool in one of those categories must name a group.
import type { IconName } from './icons.ts';

export interface CategoryGroup {
  id: string;
  label: string;
  description: string;
}

export interface Category {
  id: string;
  label: string;
  icon: IconName;
  description: string;
  groups?: readonly CategoryGroup[];
}

export const categories = [
  { id: 'crypto', label: 'Crypto', icon: 'lock', description: 'Hashing, encryption, keys, tokens and secrets.' },
  {
    id: 'converter',
    label: 'Converter',
    icon: 'arrow-left-right',
    description: 'Convert between formats, encodings, bases and units.',
    groups: [
      { id: 'encodings', label: 'Encodings', description: 'Base, hex, punycode and binary text encodings.' },
      { id: 'numbers', label: 'Numbers', description: 'Bases, number words and Roman numerals.' },
      { id: 'formats', label: 'Formats', description: 'Structured text, lists, tables and case.' },
      { id: 'units', label: 'Units and time', description: 'Units, color, dates and time zones.' },
      { id: 'signals', label: 'Signals', description: 'Morse code and the NATO alphabet.' },
    ],
  },
  { id: 'web', label: 'Web', icon: 'globe', description: 'URLs, headers, HTML, HTTP and other web plumbing.' },
  {
    id: 'images-media',
    label: 'Images and media',
    icon: 'image',
    description: 'QR codes, images, audio, video and screen capture.',
  },
  {
    id: 'development',
    label: 'Development',
    icon: 'code',
    description: 'Formatters, validators, generators and cheatsheets.',
    groups: [
      { id: 'formatters', label: 'Formatters', description: 'Format, escape and validate code and data.' },
      { id: 'generators', label: 'Generators', description: 'Build files, manifests, images and sample data.' },
      { id: 'cheatsheets', label: 'Cheatsheets', description: 'Short references for everyday developer tools.' },
      { id: 'utilities', label: 'Utilities', description: 'Query, convert, test and explain developer data.' },
    ],
  },
  {
    id: 'network',
    label: 'Network',
    icon: 'network',
    description: 'Subnets, IP addresses, MAC addresses and DNS records.',
  },
  { id: 'math', label: 'Math', icon: 'calculator', description: 'Calculators, statistics, matrices and plots.' },
  { id: 'measurement', label: 'Measurement', icon: 'ruler', description: 'Timers, clocks, rulers and benchmarks.' },
  {
    id: 'text',
    label: 'Text',
    icon: 'type',
    description: 'Inspect, clean up, compare and transform text.',
    groups: [
      { id: 'transform', label: 'Transform', description: 'Clean, restyle and rewrite text.' },
      { id: 'analyze', label: 'Analyze', description: 'Counts, readability, hidden characters and diffs.' },
      { id: 'write', label: 'Write', description: 'Draft, speak and decorate text.' },
    ],
  },
  {
    id: 'data',
    label: 'Data',
    icon: 'database',
    description: 'Validate and look up structured data such as IBANs and ISBNs.',
  },
  {
    id: 'privacy',
    label: 'Privacy',
    icon: 'shield',
    description: 'Remove metadata and keep private notes on this device.',
  },
  { id: 'documents', label: 'Documents', icon: 'file-text', description: 'Merge, split and convert PDF documents.' },
  {
    id: 'design',
    label: 'Design',
    icon: 'palette',
    description: 'Gradients, shadows, contrast and typography helpers.',
  },
] as const satisfies readonly Category[];

export type CategoryId = (typeof categories)[number]['id'];

export const categoryIds: readonly string[] = categories.map((c) => c.id);

export function getCategory(id: string): Category | undefined {
  return categories.find((c) => c.id === id);
}

/** Group ids for a category, or undefined when that category is not split. */
export function groupIdsFor(categoryId: string): readonly string[] | undefined {
  const category = getCategory(categoryId);
  if (!category?.groups?.length) return undefined;
  return category.groups.map((group) => group.id);
}

export function getGroup(categoryId: string, groupId: string): CategoryGroup | undefined {
  return getCategory(categoryId)?.groups?.find((group) => group.id === groupId);
}

/** Every curated group, as the pin id `category/group`. */
export function groupPinIds(): string[] {
  const ids: string[] = [];
  for (const category of categories) {
    for (const group of getCategory(category.id)?.groups ?? []) ids.push(`${category.id}/${group.id}`);
  }
  return ids;
}
