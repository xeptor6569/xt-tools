import { ToolInputError } from '../types.ts';

const MAX_INPUT = 1_000_000;

export interface WrapResult {
  text: string;
  start: number;
  end: number;
}

/** Reject oversized HTML. The browser sanitizes and previews whatever comes back. */
export function prepareHtml(input: string): string {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 1 MB).');
  return input;
}

/** Insert markup around the current selection. This edits the string; it does not touch the DOM. */
export function wrapSelection(source: string, start: number, end: number, open: string, close: string): WrapResult {
  if (source.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 1 MB).');
  const from = Math.max(0, Math.min(start, end, source.length));
  const to = Math.max(from, Math.min(Math.max(start, end), source.length));
  const selected = source.slice(from, to);
  const text = source.slice(0, from) + open + selected + close + source.slice(to);
  return { text, start: from + open.length, end: from + open.length + selected.length };
}

export const HTML_WRAPS = [
  { label: 'Paragraph', open: '<p>', close: '</p>' },
  { label: 'Heading', open: '<h2>', close: '</h2>' },
  { label: 'Bold', open: '<strong>', close: '</strong>' },
  { label: 'Italic', open: '<em>', close: '</em>' },
  { label: 'Code', open: '<code>', close: '</code>' },
  { label: 'Link', open: '<a href="">', close: '</a>' },
] as const;
