// Single source of truth for tool categories. Order here is display order.
import type { IconName } from './icons.ts';

export interface Category {
  id: string;
  label: string;
  icon: IconName;
  description: string;
}

export const categories = [
  { id: 'crypto', label: 'Crypto', icon: 'lock', description: 'Hashing, encryption, keys, tokens and secrets.' },
  {
    id: 'converter',
    label: 'Converter',
    icon: 'arrow-left-right',
    description: 'Convert between formats, encodings, bases and units.',
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
  },
  {
    id: 'network',
    label: 'Network',
    icon: 'network',
    description: 'Subnets, IP addresses, MAC addresses and DNS records.',
  },
  { id: 'math', label: 'Math', icon: 'calculator', description: 'Calculators, statistics, matrices and plots.' },
  { id: 'measurement', label: 'Measurement', icon: 'ruler', description: 'Timers, clocks, rulers and benchmarks.' },
  { id: 'text', label: 'Text', icon: 'type', description: 'Inspect, clean up, compare and transform text.' },
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
