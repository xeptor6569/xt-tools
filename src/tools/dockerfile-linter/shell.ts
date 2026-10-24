// Splits a RUN script into simple commands, enough to recognise package
// managers, pipes and `cd`. It is deliberately forgiving: odd syntax never throws.

export interface SimpleCommand {
  /** Words with quotes removed. */
  words: string[];
  /** The operator before this command: '' at the start, otherwise &&, ||, ;, |, & or a newline. */
  op: string;
}

const WRAPPERS = new Set([
  'exec',
  'time',
  'nohup',
  'command',
  'builtin',
  'then',
  'do',
  'else',
  'elif',
  'if',
  'while',
  'until',
  '!',
  '{',
  '(',
  'xargs',
]);

export function simpleCommands(script: string): SimpleCommand[] {
  const out: SimpleCommand[] = [];
  let words: string[] = [];
  let word: string | null = null;
  let op = '';
  const endWord = () => {
    if (word !== null) words.push(word);
    word = null;
  };
  const endCommand = (next: string) => {
    endWord();
    if (words.length) out.push({ words, op });
    words = [];
    op = next;
  };
  for (let i = 0; i < script.length; i++) {
    const c = script[i]!;
    if (c === "'") {
      const close = script.indexOf("'", i + 1);
      const end = close < 0 ? script.length : close;
      word = (word ?? '') + script.slice(i + 1, end);
      i = end;
    } else if (c === '"') {
      let j = i + 1;
      let text = '';
      for (; j < script.length && script[j] !== '"'; j++) {
        if (script[j] === '\\' && j + 1 < script.length) text += script[++j];
        else text += script[j];
      }
      word = (word ?? '') + text;
      i = j;
    } else if (c === '\\') {
      if (script[i + 1] === '\n') i++;
      else if (i + 1 < script.length) word = (word ?? '') + script[++i];
    } else if (c === ' ' || c === '\t' || c === '\r') {
      endWord();
    } else if (c === '\n') {
      endCommand('\n');
    } else if (c === '#' && word === null) {
      while (i + 1 < script.length && script[i + 1] !== '\n') i++;
    } else if (c === ';') {
      endCommand(';');
    } else if (c === '&' || c === '|') {
      const double = script[i + 1] === c;
      if (double) i++;
      endCommand(double ? c + c : c);
    } else if ((c === '(' || c === ')') && word === null) {
      endCommand(c === '(' ? op : ';');
    } else {
      word = (word ?? '') + c;
    }
  }
  endCommand('');
  return out;
}

export interface Invocation {
  /** Program name without its directory. */
  program: string;
  args: string[];
  sudo: boolean;
  op: string;
}

/** Strips variable assignments, sudo, env and shell keywords, leaving the program and its arguments. */
export function invocation(cmd: SimpleCommand): Invocation | undefined {
  const w = cmd.words;
  let i = 0;
  let sudo = false;
  while (i < w.length) {
    const word = w[i]!;
    if (/^[A-Za-z_]\w*=/.test(word) || WRAPPERS.has(word)) i++;
    else if (word === 'sudo' || word === 'doas') {
      sudo = true;
      i++;
      while (w[i]?.startsWith('-')) i += /^-[ugCDhprtT]$/.test(w[i]!) ? 2 : 1;
    } else if (word === 'env') {
      i++;
      while (w[i] !== undefined && (w[i]!.startsWith('-') || w[i]!.includes('='))) i++;
    } else break;
  }
  if (i >= w.length) return sudo ? { program: '', args: [], sudo, op: cmd.op } : undefined;
  const program = w[i]!.split('/').pop()!;
  return { program, args: w.slice(i + 1), sudo, op: cmd.op };
}
