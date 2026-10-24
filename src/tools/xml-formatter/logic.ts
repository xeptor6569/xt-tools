import { XMLValidator } from 'fast-xml-parser';
import { ToolInputError } from '../types.ts';

export type Indent = '2' | '4' | 'tab' | 'minify';

export interface XmlFormatOptions {
  indent?: Indent;
  /** Write `<x></x>` (or whitespace-only content) as `<x/>`. */
  collapseEmpty?: boolean;
  /** Put each attribute on its own line when a start tag would be longer than this. 0 turns it off. */
  wrapAttributes?: number;
}

const MAX_INPUT = 2_000_000;
const MAX_OUTPUT = 16_000_000;
const MAX_MESSAGE = 200;

type Kind = 'text' | 'open' | 'close' | 'self' | 'comment' | 'cdata' | 'pi' | 'decl' | 'doctype';

interface Token {
  kind: Kind;
  start: number;
  /** Exclusive. */
  end: number;
  /** Element name, for open, close and self-closing tags. */
  name?: string;
  /** `name="value"` with the original quotes, in source order. */
  attrs?: string[];
}

// Content flags collected for every start tag.
const HAS_TEXT = 1;
const HAS_MARKUP = 2;
const PRESERVE = 4;

function isSpace(c: string): boolean {
  return c === ' ' || c === '\t' || c === '\n' || c === '\r';
}

function lineCol(text: string, offset: number): string {
  let line = 1;
  let last = -1;
  for (let i = text.indexOf('\n'); i !== -1 && i < offset; i = text.indexOf('\n', i + 1)) {
    line++;
    last = i;
  }
  return `line ${line}, column ${offset - last}`;
}

/** Keeps names quoted in messages short. */
function short(name: string | undefined): string {
  const n = name ?? '';
  return n.length > 40 ? `${n.slice(0, 40)}…` : n;
}

function fail(text: string, offset: number, message: string): never {
  throw new ToolInputError(`Invalid XML at ${lineCol(text, offset)}: ${message}`);
}

function find(text: string, needle: string, from: number, start: number, what: string): number {
  const at = text.indexOf(needle, from);
  if (at === -1) fail(text, start, `${what} is never closed (expected "${needle}").`);
  return at + needle.length;
}

/** Scans `<!DOCTYPE …>`, including an internal subset with quoted strings and comments. */
function scanDoctype(text: string, start: number): number {
  let depth = 0;
  let i = start + 2;
  while (i < text.length) {
    const c = text[i];
    if (c === '"' || c === "'") {
      i = find(text, c, i + 1, start, 'A quoted string in the DOCTYPE');
    } else if (depth > 0 && text.startsWith('<!--', i)) {
      i = find(text, '-->', i + 4, start, 'A comment in the DOCTYPE');
    } else if (depth > 0 && text.startsWith('<?', i)) {
      i = find(text, '?>', i + 2, start, 'A processing instruction in the DOCTYPE');
    } else {
      if (c === '[') depth++;
      else if (c === ']') depth--;
      else if (c === '>' && depth <= 0) return i + 1;
      i++;
    }
  }
  return fail(text, start, 'The DOCTYPE is never closed.');
}

/** Scans a start tag, keeping attribute order, quotes and values exactly. */
function scanStartTag(text: string, start: number): Token {
  let i = start + 1;
  while (i < text.length && !isSpace(text[i]!) && text[i] !== '>' && text[i] !== '/') i++;
  const name = text.slice(start + 1, i);
  if (!name || name.includes('<')) fail(text, start, 'A "<" must start a tag; write &lt; for a literal "<".');
  const attrs: string[] = [];
  while (i < text.length) {
    const c = text[i]!;
    if (isSpace(c)) {
      i++;
    } else if (c === '>') {
      return { kind: 'open', start, end: i + 1, name, attrs };
    } else if (c === '/' && text[i + 1] === '>') {
      return { kind: 'self', start, end: i + 2, name, attrs };
    } else {
      const nameStart = i;
      while (i < text.length && !isSpace(text[i]!) && !'=>/'.includes(text[i]!)) i++;
      if (i === nameStart) i++; // a stray "/" or similar; the validator reports it
      const attrName = text.slice(nameStart, i);
      let j = i;
      while (j < text.length && isSpace(text[j]!)) j++;
      if (text[j] !== '=') {
        attrs.push(attrName);
        continue;
      }
      j++;
      while (j < text.length && isSpace(text[j]!)) j++;
      const q = text[j];
      if (q === '"' || q === "'") {
        const close = text.indexOf(q, j + 1);
        if (close === -1) fail(text, j, 'An attribute value is never closed.');
        attrs.push(`${attrName}=${text.slice(j, close + 1)}`);
        i = close + 1;
      } else {
        const valueStart = j;
        while (j < text.length && !isSpace(text[j]!) && text[j] !== '>') j++;
        attrs.push(`${attrName}=${text.slice(valueStart, j)}`);
        i = j;
      }
    }
  }
  return fail(text, start, `The start tag <${short(name)}> is never closed.`);
}

/** Splits the document into flat tokens in one linear pass, without recursion. */
function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] !== '<') {
      const next = text.indexOf('<', i);
      const end = next === -1 ? text.length : next;
      tokens.push({ kind: 'text', start: i, end });
      i = end;
    } else if (text.startsWith('<?', i)) {
      const end = find(text, '?>', i + 2, i, 'A processing instruction');
      const decl = /^<\?xml[\s?]/.test(text.slice(i, i + 6));
      tokens.push({ kind: decl ? 'decl' : 'pi', start: i, end });
      i = end;
    } else if (text.startsWith('<!--', i)) {
      const end = find(text, '-->', i + 4, i, 'A comment');
      tokens.push({ kind: 'comment', start: i, end });
      i = end;
    } else if (text.startsWith('<![CDATA[', i)) {
      const end = find(text, ']]>', i + 9, i, 'A CDATA section');
      tokens.push({ kind: 'cdata', start: i, end });
      i = end;
    } else if (text.startsWith('<!DOCTYPE', i)) {
      const end = scanDoctype(text, i);
      tokens.push({ kind: 'doctype', start: i, end });
      i = end;
    } else if (text.startsWith('<!', i)) {
      fail(text, i, 'Unknown markup after "<!" (expected a comment, CDATA section or DOCTYPE).');
    } else if (text[i + 1] === '/') {
      const end = find(text, '>', i + 2, i, 'An end tag');
      tokens.push({ kind: 'close', start: i, end, name: text.slice(i + 2, end - 1).trim() });
      i = end;
    } else {
      const token = scanStartTag(text, i);
      tokens.push(token);
      i = token.end;
    }
  }
  return tokens;
}

/** Checks well-formedness with fast-xml-parser. The DOCTYPE, which it handles only partly, is checked here. */
function validate(text: string, tokens: Token[]): void {
  let masked = text;
  let seenElement = false;
  let seenDoctype = false;
  for (const t of tokens) {
    if (t.kind === 'open' || t.kind === 'self') seenElement = true;
    if (t.kind !== 'doctype') continue;
    if (seenElement || seenDoctype) fail(text, t.start, 'A DOCTYPE is only allowed once, before the root element.');
    seenDoctype = true;
    // Same length and line breaks, so positions reported by the validator stay right.
    masked = masked.slice(0, t.start) + text.slice(t.start, t.end).replace(/[^\n]/g, ' ') + masked.slice(t.end);
  }

  const result = XMLValidator.validate(masked, { allowBooleanAttributes: false });
  if (result === true) return;
  const { msg, line, col } = result.err;
  let message = msg;
  // Unclosed tags are reported as a dump of the whole tag stack; report the innermost one instead.
  if (/^Invalid '\[/.test(msg)) {
    const stack: Token[] = [];
    for (const t of tokens) {
      if (t.kind === 'open') stack.push(t);
      else if (t.kind === 'close') stack.pop();
    }
    const open = stack.at(-1);
    if (open) fail(text, open.start, `The element <${short(open.name)}> is never closed.`);
    message = 'Some elements are never closed.';
  }
  if (message.length > MAX_MESSAGE) message = `${message.slice(0, MAX_MESSAGE)}…`;
  const where = col === undefined ? `line ${line}` : `line ${line}, column ${col}`;
  throw new ToolInputError(`Invalid XML at ${where}: ${message}`);
}

/** Pretty-prints or minifies XML without touching text, entities, comments, CDATA or attribute values. */
export function formatXml(
  input: string,
  { indent = '2', collapseEmpty = false, wrapAttributes = 0 }: XmlFormatOptions = {},
): string {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 2 MB).');
  // XML parsers normalise line breaks to \n (XML 1.0 section 2.11); the BOM is dropped.
  const text = input.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  if (text.trim() === '') return '';

  const tokens = tokenize(text);
  validate(text, tokens);

  // One pass with an explicit stack: match tags and record what each element contains.
  const closeOf = new Int32Array(tokens.length).fill(-1);
  const flags = new Uint8Array(tokens.length);
  const stack: number[] = [];
  let roots = 0;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    const top = stack.at(-1);
    if (top === undefined && (t.kind === 'open' || t.kind === 'self') && ++roots > 1) {
      fail(text, t.start, `A document has a single root element; <${short(t.name)}> is a second one.`);
    }
    switch (t.kind) {
      case 'text':
        if (top !== undefined && t.end > t.start && text.slice(t.start, t.end).trim() !== '') flags[top]! |= HAS_TEXT;
        break;
      case 'cdata':
        if (top !== undefined) flags[top]! |= HAS_TEXT;
        break;
      case 'open':
        if (top !== undefined) flags[top]! |= HAS_MARKUP;
        if (t.attrs?.some((a) => /^xml:space=(["'])preserve\1$/.test(a))) flags[i]! |= PRESERVE;
        stack.push(i);
        break;
      case 'close': {
        const open = stack.pop();
        if (open === undefined || tokens[open]!.name !== t.name) fail(text, t.start, `Unexpected </${short(t.name)}>.`);
        closeOf[open] = i;
        break;
      }
      default:
        if (top !== undefined) flags[top]! |= HAS_MARKUP;
    }
  }
  if (roots === 0) throw new ToolInputError('Invalid XML: there is no root element.');

  const minify = indent === 'minify';
  const unit = indent === 'tab' ? '\t' : indent === '4' ? '    ' : '  ';
  const indents: string[] = [''];
  const pad = (depth: number): string => {
    if (minify) return '';
    while (indents.length <= depth) indents.push(indents.at(-1)! + unit);
    return indents[depth]!;
  };

  const out: string[] = [];
  let size = 0;
  const emit = (line: string): void => {
    size += line.length + 1;
    if (size > MAX_OUTPUT) {
      throw new ToolInputError(
        'The formatted XML would be larger than 16 MB, usually because the nesting is very deep. Try Minify.',
      );
    }
    out.push(line);
  };

  const startTag = (t: Token, depth: number, selfClose: boolean): string => {
    const attrs = t.attrs ?? [];
    const end = selfClose ? '/>' : '>';
    const oneLine = `<${t.name ?? ''}${attrs.map((a) => ` ${a}`).join('')}${end}`;
    if (minify || wrapAttributes <= 0 || attrs.length < 2 || pad(depth).length + oneLine.length <= wrapAttributes) {
      return oneLine;
    }
    const inner = pad(depth + 1);
    return `<${t.name ?? ''}${attrs.map((a) => `\n${inner}${a}`).join('')}${end}`;
  };

  let depth = 0;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    switch (t.kind) {
      case 'text':
        // Text in element-only content (and around the root) is indentation; anything else is handled below.
        break;
      case 'self':
        emit(pad(depth) + startTag(t, depth, true));
        break;
      case 'open': {
        const close = closeOf[i]!;
        const f = flags[i]!;
        const closeTag = `</${t.name ?? ''}>`;
        if (f & PRESERVE || (f & HAS_TEXT && f & HAS_MARKUP)) {
          // Mixed content or xml:space="preserve": keep the whole element exactly as written.
          emit(pad(depth) + text.slice(t.start, tokens[close]!.end));
          i = close;
        } else if (f & HAS_TEXT) {
          emit(pad(depth) + startTag(t, depth, false) + text.slice(t.end, tokens[close]!.start) + closeTag);
          i = close;
        } else if (!(f & HAS_MARKUP)) {
          emit(pad(depth) + (collapseEmpty ? startTag(t, depth, true) : startTag(t, depth, false) + closeTag));
          i = close;
        } else {
          emit(pad(depth) + startTag(t, depth, false));
          depth++;
        }
        break;
      }
      case 'close':
        depth--;
        emit(`${pad(depth)}</${t.name ?? ''}>`);
        break;
      default:
        emit(pad(depth) + text.slice(t.start, t.end));
    }
  }
  return out.join(minify ? '' : '\n');
}
