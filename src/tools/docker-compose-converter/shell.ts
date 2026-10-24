// A small POSIX shell tokenizer and quoter, enough for pasted docker commands.
import { ToolInputError } from '../types.ts';

/**
 * Stands in for a `$` that the shell would pass through literally (from single
 * quotes, a backslash escape or a `$` not followed by a name). Compose would
 * interpolate a plain `$`, so it becomes `$$` in the YAML.
 */
export const LITERAL_DOLLAR = '\uE000';

export interface ShellCommand {
  words: string[];
  /** 1-based line where the command starts. */
  line: number;
  /** How the command ended: `|` means its output was piped somewhere. */
  end: 'eol' | ';' | '&&' | '||' | '|' | '&' | 'eof';
}

const NAME_START = /[A-Za-z_{(0-9@*#?$!-]/;

/** Splits shell text into commands made of words. Expansions are kept verbatim. */
export function splitCommands(input: string): ShellCommand[] {
  const commands: ShellCommand[] = [];
  let words: string[] = [];
  let word: string | null = null;
  let line = 1;
  let start = 1;
  let i = 0;
  const n = input.length;

  const endWord = () => {
    if (word !== null) words.push(word);
    word = null;
  };
  const endCommand = (end: ShellCommand['end']) => {
    endWord();
    if (words.length > 0) commands.push({ words, line: start, end });
    words = [];
    start = line;
  };
  const append = (s: string) => {
    word = (word ?? '') + s;
  };
  const dollar = (next: string | undefined) => (next !== undefined && NAME_START.test(next) ? '$' : LITERAL_DOLLAR);

  // Copies `$(...)` or `` `...` `` verbatim (from the `$` or backtick), returning the index after it.
  const readSubstitution = (from: number): number => {
    if (input[from] === '`') {
      let j = from + 1;
      while (j < n && input[j] !== '`') j += input[j] === '\\' ? 2 : 1;
      if (j >= n) throw new ToolInputError(`Unterminated backtick starting on line ${line}.`);
      append(input.slice(from, j + 1));
      return j + 1;
    }
    let depth = 0;
    let j = from + 1;
    for (; j < n; j++) {
      const c = input[j];
      if (c === '\\') j++;
      else if (c === "'") {
        const close = input.indexOf("'", j + 1);
        if (close < 0) break;
        j = close;
      } else if (c === '(') depth++;
      else if (c === ')' && --depth === 0) break;
    }
    if (j >= n) throw new ToolInputError(`Unterminated $( starting on line ${line}.`);
    append(input.slice(from, j + 1));
    return j + 1;
  };

  while (i < n) {
    const c = input[i]!;
    if (c === '\\') {
      const next = input[i + 1];
      if (next === '\n') {
        line++;
        i += 2;
      } else if (next === '\r' && input[i + 2] === '\n') {
        line++;
        i += 3;
      } else if (next === undefined) {
        i++;
      } else {
        append(next === '$' ? LITERAL_DOLLAR : next);
        i += 2;
      }
    } else if (c === "'") {
      const close = input.indexOf("'", i + 1);
      if (close < 0) throw new ToolInputError(`Unterminated single quote on line ${line}.`);
      const text = input.slice(i + 1, close);
      line += countNewlines(text);
      append(text.replaceAll('$', LITERAL_DOLLAR));
      i = close + 1;
    } else if (c === '"') {
      const open = line;
      append('');
      i++;
      for (;;) {
        if (i >= n) throw new ToolInputError(`Unterminated double quote starting on line ${open}.`);
        const d = input[i]!;
        if (d === '"') {
          i++;
          break;
        }
        if (d === '\\') {
          const next = input[i + 1];
          if (next === '\n') line++;
          if (next === '\n') i += 2;
          else if (next === '$') {
            append(LITERAL_DOLLAR);
            i += 2;
          } else if (next === '"' || next === '\\' || next === '`') {
            append(next);
            i += 2;
          } else {
            append('\\');
            i++;
          }
        } else if (d === '$' && input[i + 1] === '(') {
          i = readSubstitution(i);
        } else if (d === '`') {
          i = readSubstitution(i);
        } else if (d === '$') {
          append(dollar(input[i + 1]));
          i++;
        } else {
          if (d === '\n') line++;
          append(d);
          i++;
        }
      }
    } else if (c === '$' && input[i + 1] === '(') {
      i = readSubstitution(i);
    } else if (c === '`') {
      i = readSubstitution(i);
    } else if (c === '$') {
      append(dollar(input[i + 1]));
      i++;
    } else if (c === ' ' || c === '\t' || c === '\r') {
      endWord();
      i++;
    } else if (c === '\n') {
      endCommand('eol');
      line++;
      start = line;
      i++;
    } else if (c === '#' && word === null) {
      while (i < n && input[i] !== '\n') i++;
    } else if (c === ';') {
      endCommand(';');
      i++;
    } else if (c === '&') {
      const double = input[i + 1] === '&';
      endCommand(double ? '&&' : '&');
      i += double ? 2 : 1;
    } else if (c === '|') {
      const double = input[i + 1] === '|';
      endCommand(double ? '||' : '|');
      i += double ? 2 : 1;
    } else {
      append(c);
      i++;
    }
  }
  endCommand('eof');
  return commands;
}

function countNewlines(s: string): number {
  let count = 0;
  for (let i = s.indexOf('\n'); i >= 0; i = s.indexOf('\n', i + 1)) count++;
  return count;
}

const SAFE = /^[A-Za-z0-9_@%+=:,./-]+$/;

/** Shell-quotes a plain string so the shell passes it through unchanged. */
export function quoteLiteral(value: string): string {
  if (SAFE.test(value)) return value;
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

/** Splits a Compose string into literal text and `$VAR` / `${...}` interpolations. `$$` is a literal `$`. */
export function interpolationParts(value: string): Array<{ text: string; variable: boolean }> {
  const parts: Array<{ text: string; variable: boolean }> = [];
  let literal = '';
  let i = 0;
  while (i < value.length) {
    const c = value[i];
    if (c !== '$') {
      literal += c;
      i++;
      continue;
    }
    const next = value[i + 1];
    if (next === '$') {
      literal += '$';
      i += 2;
    } else if (next === '{') {
      let depth = 0;
      let j = i + 1;
      for (; j < value.length; j++) {
        if (value[j] === '{') depth++;
        else if (value[j] === '}' && --depth === 0) break;
      }
      if (j >= value.length) {
        literal += value.slice(i);
        break;
      }
      if (literal) parts.push({ text: literal, variable: false });
      literal = '';
      parts.push({ text: value.slice(i, j + 1), variable: true });
      i = j + 1;
    } else if (next !== undefined && /[A-Za-z_]/.test(next)) {
      let j = i + 1;
      while (j < value.length && /\w/.test(value[j]!)) j++;
      if (literal) parts.push({ text: literal, variable: false });
      literal = '';
      parts.push({ text: value.slice(i, j), variable: true });
      i = j;
    } else {
      literal += '$';
      i++;
    }
  }
  if (literal) parts.push({ text: literal, variable: false });
  return parts;
}

/**
 * Shell-quotes a Compose value: `$VAR` and `${VAR}` stay expandable (in double
 * quotes) because Compose would interpolate them too; `$$` becomes a literal `$`.
 */
export function quoteComposeValue(value: string): string {
  const parts = interpolationParts(value);
  if (!parts.some((p) => p.variable)) return quoteLiteral(parts.map((p) => p.text).join(''));
  const body = parts.map((p) => (p.variable ? p.text : p.text.replace(/[\\"`$]/g, '\\$&'))).join('');
  return `"${body}"`;
}
