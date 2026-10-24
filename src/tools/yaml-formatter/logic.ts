import {
  isMap,
  isScalar,
  isSeq,
  LineCounter,
  parseAllDocuments,
  Scalar,
  type Document,
  type Node,
  type ParsedNode,
  type YAMLError,
} from 'yaml';
import { ToolInputError } from '../types.ts';

export type Collections = 'keep' | 'block' | 'flow';
export type Quotes = 'keep' | 'plain' | 'single' | 'double';

export interface YamlFormatOptions {
  indent?: 2 | 4;
  /** Sort mapping keys at every level. Stable, by code unit. */
  sortKeys?: boolean;
  /** Fold long strings at this width; 0 never folds. */
  lineWidth?: number;
  collections?: Collections;
  /** `plain` unquotes keys and values where YAML allows; `single`/`double` quote string values. */
  quotes?: Quotes;
  /** Indent `- ` list items under their parent key. */
  indentSeq?: boolean;
}

export interface YamlFormatResult {
  text: string;
  warnings: string[];
  documents: number;
}

// The yaml parser is roughly linear but not fast; 1 MB takes about half a second.
const MAX_INPUT = 1_000_000;
const MAX_WARNINGS = 20;

const QUOTE_TYPE = {
  plain: Scalar.PLAIN,
  single: Scalar.QUOTE_SINGLE,
  double: Scalar.QUOTE_DOUBLE,
} as const;

function where(lc: LineCounter, offset: number): string {
  const { line, col } = lc.linePos(offset);
  return `line ${line}, column ${col}`;
}

function describe(lc: LineCounter, e: YAMLError): string {
  // Some messages carry their own position and a source excerpt; keep just the sentence.
  const message = (e.message.split('\n')[0] ?? '').replace(/ at line \d+, column \d+:?$/, '');
  return `${where(lc, e.pos[0])}: ${message}`;
}

function short(text: string): string {
  return text.length > 40 ? `${text.slice(0, 40)}…` : text;
}

function keyText(key: unknown): string {
  if (isScalar(key)) return String(key.value);
  // Null keys sort first, complex keys (maps or lists used as keys) last.
  return key == null ? '' : '\uFFFF';
}

/**
 * Walks the tree with an explicit stack: checks for duplicate keys in linear
 * time, then sorts keys and changes quoting as requested. Aliases are left as
 * they are, so alias bombs are never expanded.
 */
function rewrite(lc: LineCounter, root: Node | null, sortKeys: boolean, quotes: Quotes): void {
  const stack: Array<Node | null | undefined> = [root];
  const requote = (node: unknown, isKey: boolean): void => {
    if (quotes === 'keep' || !isScalar(node) || typeof node.value !== 'string') return;
    if (node.type === Scalar.BLOCK_LITERAL || node.type === Scalar.BLOCK_FOLDED) return;
    if (isKey && quotes !== 'plain') return;
    node.type = QUOTE_TYPE[quotes];
  };

  while (stack.length > 0) {
    const node = stack.pop();
    if (isMap(node)) {
      const seen = new Set<string>();
      for (const pair of node.items) {
        const key = pair.key;
        if (isScalar(key) || key == null) {
          const value = isScalar(key) ? key.value : null;
          const id = `${typeof value}:${String(value)}`;
          if (seen.has(id)) {
            const offset = (key as ParsedNode | null)?.range[0] ?? node.range?.[0] ?? 0;
            throw new ToolInputError(
              `Invalid YAML at ${where(lc, offset)}: the key "${short(keyText(key))}" appears twice.`,
            );
          }
          seen.add(id);
        }
        requote(key, true);
        requote(pair.value, false);
        stack.push(pair.key as Node | null, pair.value as Node | null);
      }
      if (sortKeys) {
        node.items.sort((a, b) => {
          const x = keyText(a.key);
          const y = keyText(b.key);
          return x < y ? -1 : x > y ? 1 : 0;
        });
      }
    } else if (isSeq(node)) {
      for (const item of node.items) {
        requote(item, false);
        stack.push(item as Node | null);
      }
    }
  }
}

/** Formats a YAML stream (one or more documents), keeping comments, anchors and tags. */
export function formatYaml(
  input: string,
  {
    indent = 2,
    sortKeys = false,
    lineWidth = 80,
    collections = 'keep',
    quotes = 'keep',
    indentSeq = true,
  }: YamlFormatOptions = {},
): YamlFormatResult {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 1 MB).');
  if (input.trim() === '') return { text: '', warnings: [], documents: 0 };

  const lc = new LineCounter();
  // uniqueKeys is checked in rewrite(): the built-in check is quadratic in the size of a mapping.
  const docs = parseAllDocuments(input, { lineCounter: lc, prettyErrors: false, uniqueKeys: false });

  const errors = docs.length === 0 && 'errors' in docs ? docs.errors : docs.flatMap((d) => d.errors);
  const [first] = errors;
  if (first?.code === 'RESOURCE_EXHAUSTION') {
    throw new ToolInputError(`The YAML is nested too deeply to format (near ${where(lc, first.pos[0])}).`);
  }
  if (first) {
    const more =
      errors.length > 1 ? ` (and ${errors.length - 1} more ${errors.length === 2 ? 'error' : 'errors'})` : '';
    throw new ToolInputError(`Invalid YAML at ${describe(lc, first)}${more}`);
  }

  const warningList = docs.length === 0 && 'warnings' in docs ? docs.warnings : docs.flatMap((d) => d.warnings);
  const warnings = warningList.slice(0, MAX_WARNINGS).map((w) => `Warning at ${describe(lc, w)}`);
  if (warningList.length > MAX_WARNINGS) warnings.push(`…and ${warningList.length - MAX_WARNINGS} more warnings.`);

  // A stream with only comments has no documents; keep the comments.
  if (docs.length === 0) {
    const comment = 'comment' in docs && typeof docs.comment === 'string' ? docs.comment : '';
    const lines = comment ? comment.split('\n').map((line) => (line ? `#${line}` : '')) : [];
    return { text: lines.length ? `${lines.join('\n')}\n` : '', warnings, documents: 0 };
  }

  const parts: string[] = [];
  for (const doc of docs as Document.Parsed[]) {
    rewrite(lc, doc.contents, sortKeys, quotes);
    try {
      parts.push(
        doc.toString({
          indent,
          indentSeq,
          lineWidth,
          collectionStyle: collections === 'keep' ? 'any' : collections,
          flowCollectionPadding: false,
        }),
      );
    } catch (error) {
      // For example an alias whose anchor is defined later or not at all.
      const message = error instanceof Error ? error.message : String(error);
      throw new ToolInputError(`This YAML can’t be formatted: ${message}`);
    }
  }
  return { text: parts.join(''), warnings, documents: docs.length };
}
