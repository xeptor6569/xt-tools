import { diffArrays, diffChars, diffWordsWithSpace } from 'diff';
import { ToolInputError } from '../types.ts';

export type Mode = 'lines' | 'words' | 'chars';

export interface DiffPart {
  kind: 'same' | 'added' | 'removed';
  text: string;
}

export interface DiffResult {
  parts: DiffPart[];
  added: number;
  removed: number;
  identical: boolean;
}

const MAX_INPUT = 2_000_000;
const MAX_CHARS_MODE = 50_000;

export function textDiff(
  before: string,
  after: string,
  { mode = 'lines' as Mode, ignoreCase = false, ignoreWhitespace = false } = {},
): DiffResult {
  if (before.length > MAX_INPUT || after.length > MAX_INPUT) throw new ToolInputError('Each text can be at most 2 MB.');
  if (mode === 'chars' && before.length + after.length > MAX_CHARS_MODE) {
    throw new ToolInputError('Character mode is limited to 50,000 characters in total; use word or line mode.');
  }
  const norm = (t: string) => {
    const x = ignoreWhitespace ? t.replace(/\s+/g, ' ').trim() : t;
    return ignoreCase ? x.toLowerCase() : x;
  };
  // A time limit keeps pathological inputs from freezing the page.
  const limit = { timeout: 5000 };
  let changes: Array<{ value: string; added: boolean; removed: boolean }> | undefined;
  if (mode === 'lines') {
    const lines = (t: string) => t.match(/[^\n]*\n|[^\n]+$/g) ?? [];
    changes = diffArrays(lines(before), lines(after), { ...limit, comparator: (l, r) => norm(l) === norm(r) })?.map(
      (c) => ({
        ...c,
        value: c.value.join(''),
      }),
    );
  } else if (mode === 'words') changes = diffWordsWithSpace(before, after, { ...limit, ignoreCase });
  else changes = diffChars(before, after, { ...limit, ignoreCase });
  if (!changes)
    throw new ToolInputError('These texts are too different to compare quickly. Try line mode or smaller texts.');

  const unit = (text: string) =>
    mode === 'lines'
      ? text.split('\n').filter((l, i, a) => l !== '' || i < a.length - 1).length
      : mode === 'words'
        ? (text.match(/\S+/g) ?? []).length
        : [...text].length;
  let added = 0;
  let removed = 0;
  const parts = changes.map((c): DiffPart => {
    if (c.added) added += unit(c.value);
    if (c.removed) removed += unit(c.value);
    return { kind: c.added ? 'added' : c.removed ? 'removed' : 'same', text: c.value };
  });
  return { parts, added, removed, identical: added === 0 && removed === 0 };
}
