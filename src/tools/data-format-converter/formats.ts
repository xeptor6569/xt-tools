// Readers and writers for each format. Each throws ToolInputError with a
// message that names the format and, where possible, the line.
import { XMLBuilder, XMLParser, XMLValidator } from 'fast-xml-parser';
import { parse as parseToml, stringify as stringifyToml } from 'smol-toml';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { csvToObjects, CsvError, objectsToRows, writeCsv } from '../../lib/csv.ts';
import { ToolInputError } from '../types.ts';

export type Format = 'json' | 'yaml' | 'toml' | 'xml' | 'csv' | 'env' | 'ini' | 'properties';

export const FORMATS: ReadonlyArray<{ value: Format; label: string }> = [
  { value: 'json', label: 'JSON' },
  { value: 'yaml', label: 'YAML' },
  { value: 'toml', label: 'TOML' },
  { value: 'xml', label: 'XML' },
  { value: 'csv', label: 'CSV' },
  { value: 'env', label: '.env' },
  { value: 'ini', label: 'INI' },
  { value: 'properties', label: 'Java properties' },
];

type Obj = Record<string, unknown>;
const isObject = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const fail = (format: string, error: unknown): never => {
  throw new ToolInputError(`Invalid ${format}: ${(error as Error).message.split('\n')[0]}`);
};

/** Flattens nested objects into dotted keys: { a: { b: 1 } } → { "a.b": "1" }. */
export function flatten(value: unknown, prefix = '', out: Record<string, string> = {}): Record<string, string> {
  if (isObject(value) || Array.isArray(value)) {
    const entries = Array.isArray(value) ? value.map((v, i) => [String(i), v] as const) : Object.entries(value);
    if (entries.length === 0 && prefix) out[prefix] = '';
    for (const [k, v] of entries) flatten(v, prefix ? `${prefix}.${k}` : k, out);
  } else if (prefix) {
    out[prefix] = value === null || value === undefined ? '' : String(value);
  }
  return out;
}

// ---- .env --------------------------------------------------------------------

function parseEnv(text: string): Obj {
  const out: Obj = {};
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) return;
    const m = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_.-]*)\s*=\s*(.*)$/.exec(line);
    if (!m) throw new ToolInputError(`Invalid .env on line ${i + 1}: expected KEY=value.`);
    let value = m[2] ?? '';
    if (/^"/.test(value)) {
      const q = /^"((?:[^"\\]|\\.)*)"/.exec(value);
      if (!q) throw new ToolInputError(`Invalid .env on line ${i + 1}: unclosed quote.`);
      value = (q[1] ?? '').replace(/\\n/g, '\n').replace(/\\(["\\])/g, '$1');
    } else if (/^'/.test(value)) {
      const q = /^'([^']*)'/.exec(value);
      if (!q) throw new ToolInputError(`Invalid .env on line ${i + 1}: unclosed quote.`);
      value = q[1] ?? '';
    } else {
      value = value.replace(/\s+#.*$/, '');
    }
    out[m[1]!] = value;
  });
  return out;
}

function writeEnv(value: unknown): string {
  if (!isObject(value)) throw new ToolInputError('.env needs an object of keys and values at the top level.');
  return Object.entries(flatten(value))
    .map(([k, v]) => {
      const key = k.replace(/[^A-Za-z0-9_]/g, '_').toUpperCase();
      return `${key}=${/^[A-Za-z0-9_./:@-]*$/.test(v) ? v : `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`}`;
    })
    .join('\n');
}

// ---- INI ---------------------------------------------------------------------

function parseIni(text: string): Obj {
  const out: Obj = {};
  let section: Obj = out;
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (line === '' || line.startsWith(';') || line.startsWith('#')) return;
    const header = /^\[([^\]]+)\]$/.exec(line);
    if (header) {
      section = {};
      out[header[1]!.trim()] = section;
      return;
    }
    const eq = line.search(/[=:]/);
    if (eq <= 0) throw new ToolInputError(`Invalid INI on line ${i + 1}: expected key = value.`);
    let value = line.slice(eq + 1).trim();
    if (/^".*"$/.test(value) || /^'.*'$/.test(value)) value = value.slice(1, -1);
    section[line.slice(0, eq).trim()] = value;
  });
  return out;
}

function writeIni(value: unknown): string {
  if (!isObject(value)) throw new ToolInputError('INI needs an object at the top level.');
  const top: string[] = [];
  const sections: string[] = [];
  const line = (k: string, v: string) => `${k} = ${/[;#\s]/.test(v) || v === '' ? `"${v}"` : v}`;
  for (const [k, v] of Object.entries(value)) {
    if (isObject(v)) sections.push(`[${k}]`, ...Object.entries(flatten(v)).map(([kk, vv]) => line(kk, vv)), '');
    else top.push(...Object.entries(flatten({ [k]: v })).map(([kk, vv]) => line(kk, vv)));
  }
  return [...top, ...(top.length && sections.length ? [''] : []), ...sections].join('\n').trimEnd();
}

// ---- Java properties -----------------------------------------------------------

function unescapeProperty(s: string): string {
  return s.replace(/\\(u[0-9a-fA-F]{4}|.)/g, (_, e: string) =>
    e.length === 5
      ? String.fromCharCode(parseInt(e.slice(1), 16))
      : (({ t: '\t', n: '\n', r: '\r', f: '\f' } as Record<string, string>)[e] ?? e),
  );
}

function parseProperties(text: string): Obj {
  const out: Obj = {};
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]!.replace(/^\s+/, '');
    if (line === '' || line.startsWith('#') || line.startsWith('!')) continue;
    // An odd number of trailing backslashes continues the line.
    while (/(^|[^\\])(\\\\)*\\$/.test(line) && i + 1 < lines.length)
      line = line.slice(0, -1) + lines[++i]!.replace(/^\s+/, '');
    const m = /^((?:[^\\:=\s]|\\.)*)\s*[:=\s]\s*(.*)$/.exec(line);
    const key = unescapeProperty(m ? m[1]! : line);
    out[key] = unescapeProperty(m ? m[2]! : '');
  }
  return out;
}

function writeProperties(value: unknown): string {
  if (!isObject(value)) throw new ToolInputError('Properties need an object at the top level.');
  const esc = (s: string, key: boolean) =>
    s
      .replace(/\\/g, '\\\\')
      .replace(/\n/g, '\\n')
      .replace(/\t/g, '\\t')
      .replace(key ? /([=: #!])/g : /^([ #!])/g, '\\$1')
      .replace(/[^\x20-\x7e]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
  return Object.entries(flatten(value))
    .map(([k, v]) => `${esc(k, true)}=${esc(v, false)}`)
    .join('\n');
}

// ---- Public API --------------------------------------------------------------

const xmlOptions = {
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseTagValue: true,
  trimValues: true,
} as const;

export function parse(text: string, format: Format): unknown {
  switch (format) {
    case 'json':
      try {
        return JSON.parse(text);
      } catch (e) {
        return fail('JSON', e);
      }
    case 'yaml':
      try {
        return parseYaml(text, { maxAliasCount: 100 });
      } catch (e) {
        return fail('YAML', e);
      }
    case 'toml':
      try {
        return parseToml(text);
      } catch (e) {
        return fail('TOML', e);
      }
    case 'xml': {
      const valid = XMLValidator.validate(text);
      if (valid !== true) throw new ToolInputError(`Invalid XML on line ${valid.err.line}: ${valid.err.msg}`);
      return new XMLParser({ ...xmlOptions, processEntities: true, htmlEntities: false }).parse(text);
    }
    case 'csv':
      try {
        return csvToObjects(text);
      } catch (e) {
        if (e instanceof CsvError) return fail('CSV', e);
        throw e;
      }
    case 'env':
      return parseEnv(text);
    case 'ini':
      return parseIni(text);
    case 'properties':
      return parseProperties(text);
  }
}

/** TOML and XML can't represent null; drop those keys rather than fail. */
function withoutNulls(value: unknown): unknown {
  if (Array.isArray(value)) return value.filter((v) => v !== null).map(withoutNulls);
  if (isObject(value))
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== null)
        .map(([k, v]) => [k, withoutNulls(v)]),
    );
  return value;
}

export function serialize(value: unknown, format: Format): string {
  switch (format) {
    case 'json':
      return JSON.stringify(value, null, 2) ?? '';
    case 'yaml':
      return stringifyYaml(value, { lineWidth: 0 }).trimEnd();
    case 'toml':
      if (!isObject(value)) throw new ToolInputError('TOML needs a table (an object) at the top level.');
      try {
        return stringifyToml(withoutNulls(value) as Obj);
      } catch (e) {
        return fail('TOML output', e);
      }
    case 'xml': {
      const root =
        isObject(value) && Object.keys(value).filter((k) => k !== '?xml').length === 1 ? value : { root: value };
      return new XMLBuilder({ ...xmlOptions, format: true, indentBy: '  ', suppressEmptyNode: true })
        .build(withoutNulls(root))
        .trimEnd();
    }
    case 'csv': {
      const items = Array.isArray(value) ? value : isObject(value) ? [value] : [value];
      return writeCsv(objectsToRows(items.map((item) => (isObject(item) ? flatten(item) : item))));
    }
    case 'env':
      return writeEnv(value);
    case 'ini':
      return writeIni(value);
    case 'properties':
      return writeProperties(value);
  }
}

/** Guesses the format of pasted text. */
export function detect(text: string): Format {
  const t = text.trim();
  const sectionHeader = /^\[[A-Za-z_][\w. -]*\]\s*$/m.test(t.split('\n')[0] ?? '');
  if (t.startsWith('{') || (t.startsWith('[') && !sectionHeader)) return 'json';
  if (t.startsWith('<')) return 'xml';
  if (/^\[[^\]]+\]\s*$/m.test(t) && /^\s*[\w.-]+\s*=\s*.+$/m.test(t))
    return /=\s*"/.test(t) || /\[\[/.test(t) ? 'toml' : 'ini';
  if (/^(export\s+)?[A-Z_][A-Z0-9_]*=/m.test(t) && !/:\s/.test(t.split('\n')[0] ?? '')) return 'env';
  if (/^[^,\n]+(,[^,\n]+)+\n[^\n]*,/.test(t)) return 'csv';
  if (/^[\w.-]+\s*=\s*/m.test(t)) return 'properties';
  return 'yaml';
}
