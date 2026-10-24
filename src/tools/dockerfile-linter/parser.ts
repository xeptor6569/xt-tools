// A hand-written Dockerfile parser: parser directives, line continuations,
// comments, heredocs, flags and exec (JSON) vs shell form.

export interface Flag {
  name: string;
  /** undefined for a bare flag such as `--link`. */
  value: string | undefined;
}

export interface Heredoc {
  name: string;
  body: string;
  /** Strip leading tabs (`<<-EOF`). */
  chomp: boolean;
}

export interface Instruction {
  /** Upper-cased keyword. */
  keyword: string;
  /** Keyword as written. */
  raw: string;
  /** 1-based line where the instruction starts. */
  line: number;
  /** Everything after the keyword, with continuations joined. */
  args: string;
  flags: Flag[];
  /** Arguments after the flags. */
  rest: string;
  /** The exec-form array, when `rest` is a valid JSON array of strings. */
  json?: string[];
  /** Why `rest` looked like JSON but couldn't be used as the exec form. */
  jsonError?: string;
  heredocs: Heredoc[];
}

export interface ParseProblem {
  line: number;
  kind: 'trailing-space' | 'empty-continuation' | 'eof-continuation' | 'unterminated-heredoc' | 'bad-escape';
  detail?: string;
}

export interface ParsedDockerfile {
  directives: Map<string, { value: string; line: number }>;
  escape: string;
  instructions: Instruction[];
  problems: ParseProblem[];
}

const DIRECTIVE = /^#\s*([A-Za-z][\w-]*)\s*=\s*(.*?)\s*$/;
const KNOWN_DIRECTIVES = new Set(['syntax', 'escape', 'check']);
const FLAGGED = new Set(['FROM', 'RUN', 'COPY', 'ADD', 'HEALTHCHECK']);
const HEREDOC_INSTRUCTIONS = new Set(['RUN', 'COPY', 'ADD']);
const HEREDOC = /(?<![<\w])<<(-?)(["']?)([A-Za-z_][\w.-]*)\2/g;

export function parseDockerfile(text: string): ParsedDockerfile {
  const lines = text.split(/\r?\n/);
  const directives = new Map<string, { value: string; line: number }>();
  const problems: ParseProblem[] = [];
  let i = 0;

  // Parser directives must come first, before any blank line, comment or instruction.
  for (; i < lines.length; i++) {
    const m = DIRECTIVE.exec(lines[i]!.trim());
    if (!m || !KNOWN_DIRECTIVES.has(m[1]!.toLowerCase())) break;
    const key = m[1]!.toLowerCase();
    if (directives.has(key)) break;
    directives.set(key, { value: m[2]!, line: i + 1 });
  }
  let escape = '\\';
  const esc = directives.get('escape');
  if (esc) {
    if (esc.value === '\\' || esc.value === '`') escape = esc.value;
    else problems.push({ line: esc.line, kind: 'bad-escape', detail: esc.value });
  }

  const instructions: Instruction[] = [];
  while (i < lines.length) {
    const first = lines[i]!;
    const trimmed = first.trim();
    if (trimmed === '' || trimmed.startsWith('#')) {
      i++;
      continue;
    }
    const start = i + 1;
    let logical = '';
    let line = first.replace(/^\s+/, '');
    for (;;) {
      const cont = continuation(line, escape);
      if (cont === undefined) {
        logical += line;
        i++;
        break;
      }
      if (cont.trailing) problems.push({ line: i + 1, kind: 'trailing-space' });
      logical += cont.text;
      i++;
      // Skip comment and blank lines inside a continued instruction.
      while (i < lines.length) {
        const t = lines[i]!.trim();
        if (t.startsWith('#')) i++;
        else if (t === '') {
          problems.push({ line: i + 1, kind: 'empty-continuation' });
          i++;
        } else break;
      }
      if (i >= lines.length) {
        problems.push({ line: start, kind: 'eof-continuation' });
        break;
      }
      line = lines[i]!;
    }

    const ins = buildInstruction(logical, start);
    if (HEREDOC_INSTRUCTIONS.has(ins.keyword)) {
      for (const m of ins.rest.matchAll(HEREDOC)) {
        const name = m[3]!;
        const chomp = m[1] === '-';
        const body: string[] = [];
        let closed = false;
        while (i < lines.length) {
          const l = lines[i++]!;
          if ((chomp ? l.replace(/^\t+/, '') : l) === name) {
            closed = true;
            break;
          }
          body.push(chomp ? l.replace(/^\t+/, '') : l);
        }
        if (!closed) problems.push({ line: start, kind: 'unterminated-heredoc', detail: name });
        ins.heredocs.push({ name, body: body.join('\n'), chomp });
      }
    }
    instructions.push(ins);
  }
  return { directives, escape, instructions, problems };
}

/** If `line` ends with the escape character (optionally followed by spaces), returns the text before it. */
function continuation(line: string, escape: string): { text: string; trailing: boolean } | undefined {
  const end = line.replace(/[ \t]+$/, '');
  if (!end.endsWith(escape)) return undefined;
  return { text: end.slice(0, -1), trailing: end.length !== line.length };
}

function buildInstruction(logical: string, line: number): Instruction {
  const m = /^(\S+)\s*([\s\S]*)$/.exec(logical) ?? ['', logical, ''];
  const raw = m[1] ?? '';
  const keyword = raw.toUpperCase();
  const args = (m[2] ?? '').trim();
  const flags: Flag[] = [];
  let rest = args;
  if (FLAGGED.has(keyword)) {
    for (;;) {
      const f = /^--([A-Za-z][\w-]*)(?:=(\S*))?(?:\s+|$)/.exec(rest);
      if (!f) break;
      flags.push({ name: f[1]!.toLowerCase(), value: f[2] });
      rest = rest.slice(f[0].length);
    }
  }
  const ins: Instruction = { keyword, raw, line, args, flags, rest, heredocs: [] };
  if (rest.startsWith('[')) {
    try {
      const parsed: unknown = JSON.parse(rest);
      if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')) ins.json = parsed;
      else ins.jsonError = 'the exec form must be a JSON array of strings';
    } catch {
      ins.jsonError = rest.includes("'")
        ? 'JSON needs double quotes; single quotes are not valid'
        : 'it is not valid JSON';
    }
  }
  return ins;
}

/** Splits shell-like arguments on whitespace, honouring single and double quotes. */
export function splitArgs(text: string): string[] {
  const out: string[] = [];
  let cur: string | null = null;
  let quote: string | null = null;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quote) {
      if (c === quote) quote = null;
      else if (c === '\\' && quote === '"' && i + 1 < text.length) cur = `${cur ?? ''}${text[++i]!}`;
      else cur = `${cur ?? ''}${c}`;
    } else if (c === '"' || c === "'") {
      quote = c;
      cur ??= '';
    } else if (c === '\\' && i + 1 < text.length) {
      cur = (cur ?? '') + text[++i];
    } else if (/\s/.test(c)) {
      if (cur !== null) out.push(cur);
      cur = null;
    } else cur = (cur ?? '') + c;
  }
  if (cur !== null) out.push(cur);
  return out;
}
