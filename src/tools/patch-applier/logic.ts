import { applyPatch, parsePatch, reversePatch, type StructuredPatch, type StructuredPatchHunk } from 'diff';
import { ToolInputError } from '../types.ts';

const MAX_INPUT = 2_000_000;
const MAX_FUZZ = 3;

export interface PatchFile {
  index: number;
  /** Display name, e.g. "src/app.ts". */
  label: string;
  hunks: number;
  /** For entries git describes without hunks (binary, rename, mode change), or new/deleted files. */
  note?: string;
}

export interface HunkReport {
  /** The header as written in the patch, e.g. "@@ -3,7 +3,8 @@". */
  header: string;
  status: 'applied' | 'failed';
  reason?: string;
  added: number;
  removed: number;
}

export interface PatchResult {
  files: PatchFile[];
  /** Index of the file whose hunks were applied. */
  file: number;
  /** The patched text; when some hunks failed, it contains only the ones that applied. */
  text: string;
  complete: boolean;
  hunks: HunkReport[];
  added: number;
  removed: number;
  notes: string[];
}

export interface PatchOptions {
  /** 0–3: how many context lines may differ. */
  fuzz?: number;
  /** Compare lines ignoring differences in whitespace. */
  ignoreWhitespace?: boolean;
  /** Undo the patch instead of applying it. */
  reverse?: boolean;
  /** Which file of a multi-file patch to apply. */
  file?: number;
}

interface Entry {
  patch: StructuredPatch;
  file: PatchFile;
}

const clip = (s: string, max = 60) => {
  const t = s.replace(/\r$/, '');
  return `"${t.length > max ? `${t.slice(0, max - 1)}…` : t}"`;
};

/** Translates the diff library's parse errors into plain messages with patch line numbers. */
function parseError(error: unknown, offset: number): ToolInputError {
  const message = error instanceof Error ? error.message : String(error);
  const at = (n: string) => Number(n) + offset;
  let m = /^Unknown line (\d+) (.*)$/s.exec(message);
  if (m)
    return new ToolInputError(
      `Line ${at(m[1]!)} of the patch is not part of a unified diff: ${clip(safeJson(m[2]!))}.`,
    );
  m = /^Hunk at line (\d+) contained invalid line (.*)$/s.exec(message);
  if (m && m[2]!.trim() === '') {
    return new ToolInputError(
      `The hunk on line ${at(m[1]!)} ends early: it has fewer lines than its @@ header says. The patch may be truncated or edited by hand.`,
    );
  }
  if (m) {
    return new ToolInputError(
      `The hunk on line ${at(m[1]!)} contains a line that doesn't start with a space, + or -: ${clip(m[2]!)}. The patch may be truncated, wrapped or edited by hand.`,
    );
  }
  m = /^(Added|Removed) line count did not match for hunk at line (\d+)$/.exec(message);
  if (m) {
    return new ToolInputError(
      `The hunk on line ${at(m[2]!)} has a different number of ${m[1]!.toLowerCase()} lines than its @@ header says. The patch may be truncated or edited by hand.`,
    );
  }
  return new ToolInputError(`The patch could not be read: ${message}`);
}

function safeJson(s: string): string {
  try {
    const v: unknown = JSON.parse(s);
    return typeof v === 'string' ? v : s;
  } catch {
    return s;
  }
}

/** parsePatch, but tolerant of the "-- " signature that git format-patch adds at the end. */
function parseChunk(text: string, offset: number): StructuredPatch[] {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return parsePatch(text);
    } catch (error) {
      const m = error instanceof Error ? /^Unknown line (\d+) "--\s?"$/.exec(error.message) : null;
      if (attempt === 0 && m) {
        text = text
          .split('\n')
          .slice(0, Number(m[1]) - 1)
          .join('\n');
        continue;
      }
      throw parseError(error, offset);
    }
  }
  throw new ToolInputError('The patch could not be read.');
}

const stripPrefix = (name: string | undefined) =>
  name === undefined ? undefined : name.replace(/^"(.*)"$/, '$1').replace(/^[ab]\//, '');

function describe(patch: StructuredPatch, gitHeader: string[], index: number): PatchFile {
  const oldName = stripPrefix(patch.oldFileName);
  const newName = stripPrefix(patch.newFileName);
  const header = gitHeader.join('\n');
  const gitNames = /^diff --git a\/(.+) b\/(.+)$/m.exec(header);
  const renameFrom = /^rename from (.+)$/m.exec(header)?.[1];
  const renameTo = /^rename to (.+)$/m.exec(header)?.[1];
  let label =
    (newName && newName !== '/dev/null' ? newName : undefined) ??
    (oldName && oldName !== '/dev/null' ? oldName : undefined) ??
    renameTo ??
    gitNames?.[2] ??
    `(unnamed file ${index + 1})`;
  let note: string | undefined;
  if (/^(?:Binary files .* differ|GIT binary patch)$/m.test(header)) note = 'binary file, cannot be applied as text';
  else if (patch.oldFileName === '/dev/null' || /^new file mode/m.test(header)) note = 'new file';
  else if (patch.newFileName === '/dev/null' || /^deleted file mode/m.test(header)) note = 'deleted file';
  else if (renameFrom && renameTo) {
    note = `renamed from ${renameFrom}`;
    label = renameTo;
  } else if (patch.hunks.length === 0 && /^old mode/m.test(header)) note = 'file mode change only';
  return { index, label, hunks: patch.hunks.length, ...(note ? { note } : {}) };
}

/** Splits a patch into one entry per file. */
export function readPatch(patch: string): Entry[] {
  const lines = patch.split('\n');
  const starts: number[] = [];
  lines.forEach((l, i) => {
    if (l.startsWith('diff --git ')) starts.push(i);
  });
  const entries: Entry[] = [];
  if (starts.length === 0) {
    for (const p of parseChunk(patch, 0)) {
      if (p.hunks.length === 0 && p.oldFileName === undefined && p.newFileName === undefined) continue;
      entries.push({ patch: p, file: describe(p, [], entries.length) });
    }
    return entries;
  }
  starts.forEach((start, k) => {
    const end = starts[k + 1] ?? lines.length;
    const chunk = lines.slice(start, end);
    const headerEnd = chunk.findIndex((l) => /^(?:---|\+\+\+|@@)\s/.test(l));
    const gitHeader = headerEnd < 0 ? chunk : chunk.slice(0, headerEnd);
    const parsed = parseChunk(chunk.join('\n'), start);
    const p = parsed.find((x) => x.hunks.length > 0) ?? parsed[0];
    if (p) entries.push({ patch: p, file: describe(p, gitHeader, entries.length) });
  });
  return entries;
}

const headerOf = (h: StructuredPatchHunk) =>
  `@@ -${h.oldLines === 0 ? h.oldStart - 1 : h.oldStart}${h.oldLines === 1 ? '' : `,${h.oldLines}`} +${
    h.newLines === 0 ? h.newStart - 1 : h.newStart
  }${h.newLines === 1 ? '' : `,${h.newLines}`} @@`;

const count = (h: StructuredPatchHunk, op: string) => h.lines.filter((l) => l[0] === op).length;
const normalize = (s: string) => s.replace(/\s+/g, ' ').trim();

/** Applies one file's hunks from a unified diff to `original`. */
export function patchApplier(original: string, patch: string, options: PatchOptions = {}): PatchResult {
  if (original.length > MAX_INPUT || patch.length > MAX_INPUT) {
    throw new ToolInputError('Input is too large (maximum 2 MB each for the text and the patch).');
  }
  if (patch.trim() === '') throw new ToolInputError('Paste a unified diff, e.g. the output of git diff or diff -u.');
  const entries = readPatch(patch);
  if (entries.length === 0) {
    throw new ToolInputError('No hunks found. A unified diff has --- / +++ file headers and @@ … @@ hunk headers.');
  }
  const fuzz = Math.min(MAX_FUZZ, Math.max(0, Math.trunc(options.fuzz ?? 0)));
  const fileIndex = Math.min(entries.length - 1, Math.max(0, Math.trunc(options.file ?? 0)));
  const entry = entries[fileIndex]!;
  const files = entries.map((e) => e.file);
  const notes: string[] = [];
  const base = { files, file: fileIndex, notes };

  if (entry.patch.hunks.length === 0) {
    notes.push(`${entry.file.label}: ${entry.file.note ?? 'no hunks'}; there is nothing to apply to the text.`);
    return { ...base, text: original, complete: true, hunks: [], added: 0, removed: 0 };
  }
  if (!options.reverse && entry.file.note === 'new file' && original.trim() !== '') {
    notes.push('This patch creates a new file, so the original text is normally empty.');
  }
  if (/\r\n/.test(original) && !/\r\n/.test(patch)) {
    notes.push('The text uses CRLF line endings; the patch was matched as if it did too.');
  }

  const structured = options.reverse ? reversePatch(entry.patch) : entry.patch;
  const apply = {
    fuzzFactor: fuzz,
    ...(options.ignoreWhitespace
      ? {
          compareLine: (_n: number, line: string | undefined, _op: string, content: string) =>
            line !== undefined && normalize(line) === normalize(content),
        }
      : {}),
  };
  const report = (h: StructuredPatchHunk, i: number, status: HunkReport['status'], reason?: string): HunkReport => ({
    header: headerOf(entry.patch.hunks[i]!),
    status,
    ...(reason ? { reason } : {}),
    added: count(h, '+'),
    removed: count(h, '-'),
  });

  const whole = applyPatch(original, structured, apply);
  if (whole !== false) {
    const hunks = structured.hunks.map((h, i) => report(h, i, 'applied'));
    return { ...base, text: whole, complete: true, hunks, ...totals(hunks) };
  }

  // Apply hunk by hunk to find out which ones fail, keeping the ones that fit.
  let text = original;
  let delta = 0;
  const hunks = structured.hunks.map((h, i) => {
    const shifted = { ...h, oldStart: h.oldStart + delta, newStart: h.newStart + delta };
    const single: StructuredPatch = { ...structured, hunks: [shifted] };
    const result = applyPatch(text, single, apply);
    if (result === false)
      return report(h, i, 'failed', diagnose(text, single, fuzz, options.ignoreWhitespace ?? false));
    text = result;
    delta += h.newLines - h.oldLines;
    return report(h, i, 'applied');
  });
  const complete = hunks.every((h) => h.status === 'applied');
  return { ...base, text, complete, hunks, ...totals(hunks) };
}

function totals(hunks: HunkReport[]) {
  const applied = hunks.filter((h) => h.status === 'applied');
  return {
    added: applied.reduce((n, h) => n + h.added, 0),
    removed: applied.reduce((n, h) => n + h.removed, 0),
  };
}

/** Explains why a single-hunk patch does not apply to `text`. */
function diagnose(text: string, single: StructuredPatch, fuzz: number, ignoreWhitespace: boolean): string {
  const hunk = single.hunks[0]!;
  const strict = ignoreWhitespace
    ? {
        compareLine: (_n: number, line: string | undefined, _op: string, content: string) =>
          line !== undefined && normalize(line) === normalize(content),
      }
    : {};
  if (applyPatch(text, reversePatch(single), strict) !== false) {
    return 'These changes are already in the text. Was the patch applied before? Turn on "Reverse" to undo it.';
  }
  const lines = text.split('\n').map((l) => l.replace(/\r$/, ''));
  const old = hunk.lines
    .filter((l) => l[0] === ' ' || l[0] === '-')
    .map((l) => ({ op: l[0]!, text: l.slice(1).replace(/\r$/, '') }));
  const same = (a: string | undefined, b: string) =>
    a !== undefined && (ignoreWhitespace ? normalize(a) === normalize(b) : a === b);

  // Candidate positions: where the header says, and wherever the first line to remove appears.
  const expected = Math.max(0, hunk.oldStart - 1);
  const candidates = [expected];
  const anchor = old.findIndex((l) => l.op === '-');
  if (anchor >= 0) {
    for (let i = 0, found = 0; i < lines.length && found < 1000; i++) {
      if (same(lines[i], old[anchor]!.text)) {
        candidates.push(i - anchor);
        found++;
      }
    }
  }
  let best = expected;
  let bestScore = -1;
  for (const pos of candidates) {
    if (pos < 0) continue;
    let score = 0;
    old.forEach((l, j) => {
      if (same(lines[pos + j], l.text)) score++;
    });
    if (score > bestScore || (score === bestScore && Math.abs(pos - expected) < Math.abs(best - expected))) {
      best = pos;
      bestScore = score;
    }
  }

  if (old.length > 0 && best >= lines.length) {
    return `The hunk starts at line ${best + 1}, but the text only has ${lines.length} line${lines.length === 1 ? '' : 's'}.`;
  }
  const mismatch = old.findIndex((l, j) => !same(lines[best + j], l.text));
  if (mismatch < 0) {
    return old.length === 0
      ? 'The lines around the insertion point do not match the text.'
      : 'The lines match, but the end of the text does not: the patch expects a different "newline at end of file".';
  }
  const lineNo = best + mismatch + 1;
  const wanted = old[mismatch]!;
  const actual = lines[best + mismatch];
  const what = wanted.op === '-' ? 'line to remove' : 'context line';
  let reason =
    actual === undefined
      ? `The text ends before line ${lineNo}, where the patch expects the ${what} ${clip(wanted.text)}.`
      : `Line ${lineNo} is ${clip(actual)}, but the patch expects the ${what} ${clip(wanted.text)}.`;
  if (actual !== undefined && !ignoreWhitespace && normalize(actual) === normalize(wanted.text)) {
    reason += ' They differ only in whitespace; try "Ignore whitespace".';
  } else if (wanted.op === ' ' && fuzz < MAX_FUZZ) {
    reason += ' A higher fuzz factor lets a few context lines differ.';
  } else if (wanted.op === '-') {
    reason += ' Lines to remove must always match.';
  }
  return reason;
}
