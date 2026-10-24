import { createTwoFilesPatch } from 'diff';
import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { patchApplier, readPatch } from './logic.ts';
import meta from './meta.ts';
import { SAMPLE_ORIGINAL, SAMPLE_PATCH } from './samples.ts';

const lines = (...l: string[]) => l.join('\n');

const APP_BEFORE = lines(
  'import sys',
  '',
  '',
  'def greet(name):',
  '    print("Hello, " + name)',
  '',
  '',
  'def main():',
  '    greet(sys.argv[1])',
  '',
  '',
  'if __name__ == "__main__":',
  '    main()',
  '',
);
const APP_AFTER = lines(
  'import sys',
  '',
  '',
  'def greet(name, greeting="Hello"):',
  '    print(f"{greeting}, {name}!")',
  '',
  '',
  'def main():',
  '    if len(sys.argv) < 2:',
  '        sys.exit("usage: app.py NAME")',
  '    greet(sys.argv[1])',
  '',
  '',
  'if __name__ == "__main__":',
  '    main()',
  '',
);

/** Real `git diff --cached -M` output: a rename, an edit, a new file, a deletion and a newline change. */
const GIT_DIFF = lines(
  'diff --git a/before.txt b/after.txt',
  'similarity index 100%',
  'rename from before.txt',
  'rename to after.txt',
  'diff --git a/app.py b/app.py',
  'index 588735d..5fba4c6 100644',
  '--- a/app.py',
  '+++ b/app.py',
  '@@ -1,11 +1,13 @@',
  ' import sys',
  ' ',
  ' ',
  '-def greet(name):',
  '-    print("Hello, " + name)',
  '+def greet(name, greeting="Hello"):',
  '+    print(f"{greeting}, {name}!")',
  ' ',
  ' ',
  ' def main():',
  '+    if len(sys.argv) < 2:',
  '+        sys.exit("usage: app.py NAME")',
  '     greet(sys.argv[1])',
  ' ',
  ' ',
  'diff --git a/fresh.txt b/fresh.txt',
  'new file mode 100644',
  'index 0000000..d5a09df',
  '--- /dev/null',
  '+++ b/fresh.txt',
  '@@ -0,0 +1 @@',
  '+brand new',
  'diff --git a/gone.txt b/gone.txt',
  'deleted file mode 100644',
  'index 3367afd..0000000',
  '--- a/gone.txt',
  '+++ /dev/null',
  '@@ -1 +0,0 @@',
  '-old',
  'diff --git a/notes.txt b/notes.txt',
  'index d3a401f..efa423f 100644',
  '--- a/notes.txt',
  '+++ b/notes.txt',
  '@@ -1,3 +1,3 @@',
  ' line one',
  '-line two',
  '-last line without newline',
  '\\ No newline at end of file',
  '+line 2',
  '+last line now ends with newline',
  '',
);

const LIST = Array.from({ length: 20 }, (_, i) => `item ${i + 1}`).join('\n') + '\n';

/** Real `diff -u` output (with timestamps) with two hunks. */
const DIFF_U = lines(
  '--- list.old\t2026-10-24 10:00:00.000000000 +0200',
  '+++ list.new\t2026-10-24 10:01:00.000000000 +0200',
  '@@ -1,6 +1,6 @@',
  ' item 1',
  ' item 2',
  '-item 3',
  '+item three',
  ' item 4',
  ' item 5',
  ' item 6',
  '@@ -14,7 +14,7 @@',
  ' item 14',
  ' item 15',
  ' item 16',
  '-item 17',
  '+item seventeen',
  ' item 18',
  ' item 19',
  ' item 20',
  '',
);
const LIST_AFTER = LIST.replace('item 3\n', 'item three\n').replace('item 17\n', 'item seventeen\n');

describe('patchApplier', () => {
  it('applies the meta examples to empty text', () => {
    for (const ex of meta.examples ?? []) expect(patchApplier('', ex.input).text).toContain(ex.expect);
  });

  it('applies the sample used by the UI', () => {
    const r = patchApplier(SAMPLE_ORIGINAL, SAMPLE_PATCH);
    expect(r.complete).toBe(true);
    expect(r.text).toBe(
      SAMPLE_ORIGINAL.replace('127.0.0.1', '0.0.0.0').replace('workers = 2', 'workers = 4\ntimeout = 30'),
    );
  });

  it('lists every file in a git diff', () => {
    const { files } = patchApplier(APP_BEFORE, GIT_DIFF, { file: 1 });
    expect(files).toEqual([
      { index: 0, label: 'after.txt', hunks: 0, note: 'renamed from before.txt' },
      { index: 1, label: 'app.py', hunks: 1 },
      { index: 2, label: 'fresh.txt', hunks: 1, note: 'new file' },
      { index: 3, label: 'gone.txt', hunks: 1, note: 'deleted file' },
      { index: 4, label: 'notes.txt', hunks: 1 },
    ]);
  });

  it('applies a real git diff hunk', () => {
    const r = patchApplier(APP_BEFORE, GIT_DIFF, { file: 1 });
    expect(r.text).toBe(APP_AFTER);
    expect(r.complete).toBe(true);
    expect(r.hunks).toEqual([{ header: '@@ -1,11 +1,13 @@', status: 'applied', added: 4, removed: 2 }]);
    expect([r.added, r.removed]).toEqual([4, 2]);
  });

  it('creates and deletes files', () => {
    expect(patchApplier('', GIT_DIFF, { file: 2 }).text).toBe('brand new\n');
    expect(patchApplier('old\n', GIT_DIFF, { file: 3 }).text).toBe('');
    expect(patchApplier('something\n', GIT_DIFF, { file: 2 }).notes.join()).toMatch(/creates a new file/);
  });

  it('handles "No newline at end of file"', () => {
    const before = 'line one\nline two\nlast line without newline';
    const after = 'line one\nline 2\nlast line now ends with newline\n';
    expect(patchApplier(before, GIT_DIFF, { file: 4 }).text).toBe(after);
    expect(patchApplier(after, GIT_DIFF, { file: 4, reverse: true }).text).toBe(before);
    // The patch removes a line that has no newline; the text has one, so it doesn't apply.
    expect(patchApplier(`${before}\n`, GIT_DIFF, { file: 4 }).complete).toBe(false);
  });

  it('reports entries that have no hunks', () => {
    const r = patchApplier('keep me\n', GIT_DIFF, { file: 0 });
    expect(r).toMatchObject({ text: 'keep me\n', complete: true, hunks: [] });
    expect(r.notes[0]).toMatch(/after\.txt: renamed from before\.txt; there is nothing to apply/);
  });

  it('defaults to the first file and clamps the index', () => {
    expect(patchApplier('x', DIFF_U).file).toBe(0);
    expect(patchApplier(LIST, DIFF_U, { file: 9 }).file).toBe(0);
  });

  it('applies diff -u output with several hunks', () => {
    const r = patchApplier(LIST, DIFF_U);
    expect(r.text).toBe(LIST_AFTER);
    expect(r.files).toEqual([{ index: 0, label: 'list.new', hunks: 2 }]);
    expect(r.hunks.map((h) => h.header)).toEqual(['@@ -1,6 +1,6 @@', '@@ -14,7 +14,7 @@']);
  });

  it('finds hunks that moved', () => {
    const shifted = `header 1\nheader 2\n${LIST}`;
    expect(patchApplier(shifted, DIFF_U).text).toBe(`header 1\nheader 2\n${LIST_AFTER}`);
  });

  it('reverses a patch', () => {
    expect(patchApplier(LIST_AFTER, DIFF_U, { reverse: true }).text).toBe(LIST);
    expect(patchApplier(APP_AFTER, GIT_DIFF, { file: 1, reverse: true }).text).toBe(APP_BEFORE);
    const r = patchApplier(LIST_AFTER, DIFF_U, { reverse: true });
    expect(r.hunks[0]).toMatchObject({ header: '@@ -1,6 +1,6 @@', added: 1, removed: 1 });
  });

  it('reports which hunk failed and why, keeping the others', () => {
    const edited = LIST.replace('item 16', 'item sixteen');
    const r = patchApplier(edited, DIFF_U);
    expect(r.complete).toBe(false);
    expect(r.hunks.map((h) => h.status)).toEqual(['applied', 'failed']);
    expect(r.hunks[1]!.header).toBe('@@ -14,7 +14,7 @@');
    expect(r.hunks[1]!.reason).toBe(
      'Line 16 is "item sixteen", but the patch expects the context line "item 16". A higher fuzz factor lets a few context lines differ.',
    );
    expect(r.text).toBe(edited.replace('item 3\n', 'item three\n'));
    expect([r.added, r.removed]).toEqual([1, 1]);
  });

  it('explains a missing line to remove', () => {
    const r = patchApplier(LIST.replace('item 17', 'item 17b'), DIFF_U, { fuzz: 2 });
    expect(r.hunks[1]!.reason).toMatch(
      /Line 17 is "item 17b", but the patch expects the line to remove "item 17"\. Lines to remove must always match\./,
    );
  });

  it('detects a patch that was already applied', () => {
    const r = patchApplier(LIST_AFTER, DIFF_U);
    expect(r.hunks.every((h) => h.status === 'failed')).toBe(true);
    expect(r.hunks[0]!.reason).toMatch(/already in the text.*Reverse/);
  });

  it('explains a text that is too short', () => {
    const r = patchApplier('item 1\n', DIFF_U);
    expect(r.hunks[1]!.reason).toMatch(/starts at line 14, but the text only has 2 lines/);
  });

  it('applies with fuzz when context lines differ', () => {
    const edited = LIST.replace('item 14', 'item fourteen');
    expect(patchApplier(edited, DIFF_U).complete).toBe(false);
    const r = patchApplier(edited, DIFF_U, { fuzz: 1 });
    expect(r.complete).toBe(true);
    expect(r.text).toBe(LIST_AFTER.replace('item 14', 'item fourteen'));
    // Fuzz is clamped to 0–3.
    expect(patchApplier(edited, DIFF_U, { fuzz: 99 }).complete).toBe(true);
    expect(patchApplier(LIST, DIFF_U, { fuzz: -1 }).complete).toBe(true);
  });

  it('can ignore whitespace differences', () => {
    const spaced = LIST.replace('item 2\n', 'item  2 \n').replace('item 3\n', '  item 3\n');
    const strict = patchApplier(spaced, DIFF_U);
    expect(strict.complete).toBe(false);
    expect(strict.hunks[0]!.reason).toMatch(/only in whitespace; try "Ignore whitespace"/);
    const r = patchApplier(spaced, DIFF_U, { ignoreWhitespace: true });
    expect(r.complete).toBe(true);
    // Context lines keep the text's own whitespace.
    expect(r.text.startsWith('item 1\nitem  2 \nitem three\n')).toBe(true);
  });

  it('handles CRLF text with an LF patch, and a CRLF patch with LF text', () => {
    const crlf = LIST.replaceAll('\n', '\r\n');
    const r = patchApplier(crlf, DIFF_U);
    expect(r.text).toBe(LIST_AFTER.replaceAll('\n', '\r\n'));
    expect(r.notes.join()).toMatch(/CRLF/);
    expect(patchApplier(LIST, DIFF_U.replaceAll('\n', '\r\n')).text).toBe(LIST_AFTER);
  });

  it('round-trips patches made by the diff library', () => {
    const cases: Array<[string, string]> = [
      ['a\nb\nc\n', 'a\nB\nc\nd\n'],
      ['', 'new\n'],
      ['x\n', ''],
      ['no newline', 'no newline\n'],
      ['é 日本語 🚀\n', 'é 日本語 🚀 !\n'],
      [LIST, LIST_AFTER],
    ];
    for (const [a, b] of cases) {
      const patch = createTwoFilesPatch('a/f', 'b/f', a, b);
      expect(patchApplier(a, patch).text, JSON.stringify([a, b])).toBe(b);
      expect(patchApplier(b, patch, { reverse: true }).text, JSON.stringify([a, b])).toBe(a);
    }
  });

  it('accepts git format-patch output with its signature', () => {
    const mail = lines(
      'From 1234567890abcdef Mon Sep 17 00:00:00 2001',
      'From: Dev <dev@example.com>',
      'Subject: [PATCH] Rename items',
      '',
      '---',
      ' list.txt | 4 ++--',
      ' 1 file changed, 2 insertions(+), 2 deletions(-)',
      '',
      'diff --git a/list.txt b/list.txt',
      'index 1111111..2222222 100644',
      DIFF_U.replace(/^--- .*\n\+\+\+ .*\n/, '--- a/list.txt\n+++ b/list.txt\n'),
      '-- ',
      '2.43.0',
      '',
    );
    const r = patchApplier(LIST, mail);
    expect(r.files.map((f) => f.label)).toEqual(['list.txt']);
    expect(r.text).toBe(LIST_AFTER);
  });

  it('accepts hunks without file headers', () => {
    const bare = DIFF_U.split('\n').slice(2).join('\n');
    const r = patchApplier(LIST, bare);
    expect(r.text).toBe(LIST_AFTER);
    expect(r.files[0]!.label).toBe('(unnamed file 1)');
  });

  it('explains unreadable patches', () => {
    expect(() => patchApplier('x', '')).toThrow(/Paste a unified diff/);
    expect(() => patchApplier('x', 'hello')).toThrow(/No hunks found/);
    expect(() => patchApplier('x', '--- a\n+++ b\n@@ -1,2 +1,2 @@\n-a\n+b\n')).toThrow(
      /hunk on line 3 ends early: it has fewer lines than its @@ header says/,
    );
    expect(() => patchApplier('x', '--- a\n+++ b\n@@ -1,2 +1 @@\n-a\n+b\n+c\n-d\n')).toThrow(
      /hunk on line 3 has a different number of added lines than its @@ header says/,
    );
    expect(() => patchApplier('x', '--- a\n+++ b\n@@ -1,2 +1,2 @@\n-a\nzzz\n+b\n')).toThrow(
      /hunk on line 3 contains a line that doesn't start with a space, \+ or -: "zzz"/,
    );
    expect(() => patchApplier('x', '--- a\n+++ b\n@@ -1 +1 @@\n-a\n+b\ngarbage\n')).toThrow(
      /Line 6 of the patch is not part of a unified diff: "garbage"/,
    );
    expect(() =>
      patchApplier(
        'x',
        'diff --git a/x b/x\n--- a/x\n+++ b/x\n@@ -1 +1 @@\n-a\n+b\ndiff --git a/y b/y\n--- a/y\n+++ b/y\n@@ -1,3 +1 @@\n-a\n',
      ),
    ).toThrow(/hunk on line 10/);
  });

  it('rejects inputs over 2 MB', () => {
    expect(() => patchApplier('a'.repeat(2_000_001), DIFF_U)).toThrow(ToolInputError);
    expect(() => patchApplier('', 'a'.repeat(2_000_001))).toThrow(ToolInputError);
  });

  it('reads file names with spaces and quotes', () => {
    const entries = readPatch('--- "a/my file.txt"\n+++ "b/my file.txt"\n@@ -1 +1 @@\n-a\n+b\n');
    expect(entries[0]!.file.label).toBe('my file.txt');
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust((patch) => patchApplier('', patch), {
      malformed: [
        '@@',
        '@@ -1 +1 @@',
        '@@ -a,b +c,d @@\n+x',
        '--- a\n+++ b\n@@ -0,0 +1,99999999 @@\n+x',
        'diff --git ',
        '\\ No newline',
      ],
    });
    expectRobust((text) => patchApplier(text, DIFF_U));
    expectRobust((text) => patchApplier(text, DIFF_U, { fuzz: 3, ignoreWhitespace: true }));
  });

  it('is fast on larger texts', () => {
    const big = Array.from({ length: 50_000 }, (_, i) => `line ${i}`).join('\n');
    const start = performance.now();
    const r = patchApplier(big, DIFF_U, { fuzz: 3 });
    expect(r.complete).toBe(false);
    expect(performance.now() - start).toBeLessThan(2000);
  });
});
