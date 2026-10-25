import { ToolInputError } from '../types.ts';

const MAX_INPUT = 1_000_000;

export interface OgFields {
  title: string;
  description: string;
  url: string;
  image: string;
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function parseOgLine(input: string): OgFields {
  const parts = input.split('|').map((part) => part.trim());
  return {
    title: parts[0] ?? '',
    description: parts[1] ?? '',
    url: parts[2] ?? '',
    image: parts[3] ?? '',
  };
}

export function formatOgLine(fields: OgFields): string {
  return [fields.title, fields.description, fields.url, fields.image].join(' | ');
}

function tag(attr: 'property' | 'name', name: string, content: string): string | undefined {
  if (!content) return undefined;
  return `<meta ${attr}="${escapeAttr(name)}" content="${escapeAttr(content)}" />`;
}

/** Build Open Graph and Twitter card tags from `title | description | url | image`. */
export function ogMetaTags(input: string): string {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 1 MB).');
  const fields = parseOgLine(input);
  if (![fields.title, fields.description, fields.url, fields.image].some(Boolean)) return '';
  const lines = [
    tag('property', 'og:title', fields.title),
    tag('property', 'og:description', fields.description),
    tag('property', 'og:type', 'website'),
    tag('property', 'og:url', fields.url),
    tag('property', 'og:image', fields.image),
    tag('name', 'twitter:card', fields.image ? 'summary_large_image' : 'summary'),
    tag('name', 'twitter:title', fields.title),
    tag('name', 'twitter:description', fields.description),
    tag('name', 'twitter:image', fields.image),
  ];
  return lines.filter((line): line is string => line !== undefined).join('\n');
}
