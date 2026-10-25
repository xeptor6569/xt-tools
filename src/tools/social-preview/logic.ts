import { ToolInputError } from '../types.ts';

const MAX_INPUT = 1_000_000;

export interface SocialCard {
  text: string;
  html: string;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** `title | description` as plain text plus a card that contains no remote images. */
export function socialPreview(input: string): SocialCard {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 1 MB).');
  const trimmed = input.trim();
  if (trimmed === '') return { text: '', html: '' };
  const bar = trimmed.indexOf('|');
  const title = (bar < 0 ? trimmed : trimmed.slice(0, bar)).trim();
  const description = (bar < 0 ? '' : trimmed.slice(bar + 1)).trim();
  const text = `Title: ${title}\nDescription: ${description}`;
  const html = `<article><h2>${escapeHtml(title)}</h2><p>${escapeHtml(description)}</p></article>`;
  return { text, html };
}
