import { ToolInputError } from '../types.ts';

const MAX_INPUT = 1_000_000;
const VOID = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);
const RAW = new Set(['script', 'style', 'pre', 'textarea']);

export type SourceLang = 'html' | 'css' | 'js';

function tooLarge(input: string): void {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 1 MB).');
}

export function splitSource(input: string): { lang: SourceLang; source: string } {
  const nl = input.indexOf('\n');
  const first = (nl === -1 ? input : input.slice(0, nl)).trim().toLowerCase();
  if (first === 'html' || first === 'css' || first === 'js') {
    return { lang: first, source: nl === -1 ? '' : input.slice(nl + 1) };
  }
  return { lang: 'html', source: input };
}

function formatResult(minified: string, beautified: string): string {
  return `minified:\n${minified}\n\nbeautified:\n${beautified}`;
}

function closeTag(html: string, from: number, name: string): number {
  const lower = html.toLowerCase();
  const at = lower.indexOf(`</${name}`, from);
  if (at < 0) return -1;
  const end = html.indexOf('>', at);
  return end < 0 ? -1 : end + 1;
}

/** Remove comments and collapse whitespace. Raw script, style, pre and textarea contents stay intact. */
export function minifyHtml(html: string): string {
  let out = '';
  let i = 0;
  while (i < html.length) {
    if (html.startsWith('<!--', i)) {
      const end = html.indexOf('-->', i + 4);
      i = end < 0 ? html.length : end + 3;
      continue;
    }
    if (html[i] === '<') {
      const end = html.indexOf('>', i + 1);
      if (end < 0) {
        out += html.slice(i);
        break;
      }
      const tag = html
        .slice(i, end + 1)
        .replace(/\s+/g, ' ')
        .replace(/\s+>/, '>');
      out += tag;
      const name = /^<\s*([a-zA-Z0-9:-]+)/.exec(tag)?.[1]?.toLowerCase();
      i = end + 1;
      if (name && RAW.has(name)) {
        const close = closeTag(html, i, name);
        if (close < 0) {
          out += html.slice(i);
          break;
        }
        out += html.slice(i, close);
        i = close;
      }
      continue;
    }
    let j = i;
    while (j < html.length && html[j] !== '<' && !html.startsWith('<!--', j)) j++;
    const text = html.slice(i, j).replace(/\s+/g, ' ').trim();
    if (text) out += text;
    i = j;
  }
  return out.trim();
}

export function beautifyHtml(min: string): string {
  const lines: string[] = [];
  let i = 0;
  let indent = 0;
  while (i < min.length) {
    if (min[i] === '<') {
      const end = min.indexOf('>', i);
      if (end < 0) {
        lines.push(`${'  '.repeat(indent)}${min.slice(i)}`);
        break;
      }
      const tag = min.slice(i, end + 1);
      const closing = /^<\s*\//.test(tag);
      const name = /^<\/?\s*([a-zA-Z0-9:-]+)/.exec(tag)?.[1]?.toLowerCase() ?? '';
      const self = tag.endsWith('/>') || VOID.has(name);
      if (closing) indent = Math.max(0, indent - 1);
      lines.push(`${'  '.repeat(indent)}${tag}`);
      if (!closing && !self) indent++;
      i = end + 1;
      continue;
    }
    const next = min.indexOf('<', i);
    const text = (next < 0 ? min.slice(i) : min.slice(i, next)).trim();
    if (text) lines.push(`${'  '.repeat(indent)}${text}`);
    if (next < 0) break;
    i = next;
  }
  return lines.join('\n');
}

function readCssString(css: string, i: number): number {
  const quote = css[i];
  let j = i + 1;
  while (j < css.length) {
    if (css[j] === '\\') {
      j += 2;
      continue;
    }
    if (css[j] === quote) return j + 1;
    j++;
  }
  return css.length;
}

/** Remove CSS comments and the spaces around punctuation. Strings are left intact. */
export function minifyCss(css: string): string {
  let out = '';
  let i = 0;
  while (i < css.length) {
    if (css[i] === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      i = end < 0 ? css.length : end + 2;
      continue;
    }
    if (css[i] === '"' || css[i] === "'") {
      const end = readCssString(css, i);
      out += css.slice(i, end);
      i = end;
      continue;
    }
    if (/\s/.test(css[i] ?? '')) {
      let k = i;
      while (k < css.length && /\s/.test(css[k] ?? '')) k++;
      const next = css[k];
      const prev = out.at(-1);
      if (prev && next && !/[\s{};:,]/.test(prev) && !/[{};:,]/.test(next)) out += ' ';
      i = k;
      continue;
    }
    const ch = css[i] ?? '';
    if ('{};:,'.includes(ch) && out.endsWith(' ')) out = out.slice(0, -1);
    out += ch;
    i++;
  }
  return out.trim();
}

export function beautifyCss(min: string): string {
  let indent = 0;
  let out = '';
  let i = 0;
  while (i < min.length) {
    const ch = min[i] ?? '';
    if (ch === '"' || ch === "'") {
      const end = readCssString(min, i);
      out += min.slice(i, end);
      i = end;
      continue;
    }
    if (ch === '{') {
      indent++;
      out += ` {\n${'  '.repeat(indent)}`;
      i++;
      continue;
    }
    if (ch === '}') {
      indent = Math.max(0, indent - 1);
      out = out.trimEnd();
      out += `\n${'  '.repeat(indent)}}\n${'  '.repeat(indent)}`;
      i++;
      continue;
    }
    if (ch === ';') {
      out += `;\n${'  '.repeat(indent)}`;
      i++;
      continue;
    }
    if (ch === ':') {
      out += ': ';
      i++;
      continue;
    }
    out += ch;
    i++;
  }
  return `${out.trim()}\n`;
}

interface JsToken {
  start: number;
  end: number;
  type: { label: string; keyword?: string | undefined };
}

function isWord(token: JsToken): boolean {
  return (
    token.type.label === 'name' ||
    token.type.label === 'num' ||
    token.type.label === 'privateId' ||
    Boolean(token.type.keyword)
  );
}

function needsSpace(prevWord: boolean, text: string, label: string): boolean {
  if (!prevWord) return false;
  if (label === 'regexp' || label === 'string' || label === 'template' || label === 'invalidTemplate') return true;
  return /^[\w$]/.test(text) || text.startsWith('#');
}

async function jsTokens(source: string): Promise<JsToken[]> {
  const acorn = await import('acorn');
  const options = { ecmaVersion: 'latest' as const, sourceType: 'module' as const, allowHashBang: true };
  try {
    // The tokenizer accepts fragments such as "function (". Parse first so invalid JavaScript is rejected.
    acorn.parse(source, options);
    return [...acorn.tokenizer(source, options)];
  } catch (error) {
    if (error instanceof ToolInputError) throw error;
    const message = error instanceof Error ? error.message : 'Could not read this JavaScript.';
    throw new ToolInputError(message.split('\n')[0] ?? 'Could not read this JavaScript.');
  }
}

function joinTokens(source: string, tokens: readonly JsToken[], pretty: boolean): string {
  let indent = 0;
  let out = '';
  let lineStart = true;
  let prevWord = false;
  const pad = () => {
    if (!pretty || !lineStart) return;
    out += '  '.repeat(indent);
    lineStart = false;
  };
  const newline = () => {
    out += '\n';
    lineStart = true;
    prevWord = false;
  };
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (!token) continue;
    const text = source.slice(token.start, token.end);
    if (pretty && text === '}') {
      indent = Math.max(0, indent - 1);
      if (!lineStart) newline();
    }
    if (needsSpace(prevWord, text, token.type.label)) {
      if (pretty && lineStart) pad();
      else out += ' ';
    }
    pad();
    out += text;
    prevWord = isWord(token);
    if (!pretty) continue;
    if (text === '{') {
      indent++;
      newline();
    } else if (text === ';') {
      const next = tokens[index + 1];
      const nextText = next ? source.slice(next.start, next.end) : '';
      if (nextText !== ';' && nextText !== ')') newline();
    } else if (text === '}') {
      newline();
    }
  }
  return pretty ? `${out.trim()}\n` : out;
}

/**
 * Minify by removing comments and collapsing whitespace, and beautify with a conservative indent.
 * The first line may be `html`, `css` or `js`; otherwise the source is HTML.
 * JavaScript comments are dropped with the acorn tokenizer. The source is never executed.
 */
export async function codeMinifier(input: string): Promise<string> {
  tooLarge(input);
  const { lang, source } = splitSource(input);
  if (source.trim() === '') return '';
  if (lang === 'js') {
    const tokens = await jsTokens(source);
    return formatResult(joinTokens(source, tokens, false), joinTokens(source, tokens, true));
  }
  if (lang === 'css') {
    const min = minifyCss(source);
    return formatResult(min, beautifyCss(min));
  }
  const min = minifyHtml(source);
  return formatResult(min, beautifyHtml(min));
}
