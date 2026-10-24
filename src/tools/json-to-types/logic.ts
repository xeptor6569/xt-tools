import {
  buildModel,
  kinds,
  parseSample,
  sanitizeRootName,
  snakeCase,
  words,
  type Model,
  type ObjectShape,
  type Shape,
} from './model.ts';
import { ToolInputError } from '../types.ts';

const MAX_INPUT = 1_000_000;

export type Language = 'typescript' | 'go' | 'rust' | 'python';
export type TsDeclaration = 'interface' | 'type';
export type PythonStyle = 'dataclass' | 'typeddict';

export interface JsonToTypesOptions {
  language?: Language;
  /** Name of the top-level type (default "Root"). */
  rootName?: string;
  tsDeclaration?: TsDeclaration;
  tsExport?: boolean;
  tsReadonly?: boolean;
  pythonStyle?: PythonStyle;
}

export const FILE_EXTENSIONS: Record<Language, string> = { typescript: 'ts', go: 'go', rust: 'rs', python: 'py' };

/** Generates type definitions for a sample JSON document. Empty input gives empty output. */
export function jsonToTypes(input: string, options: JsonToTypesOptions = {}): string {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 1 MB).');
  if (input.trim() === '') return '';
  const value = parseSample(input);
  const model = buildModel(value, sanitizeRootName(options.rootName ?? 'Root'));
  switch (options.language ?? 'typescript') {
    case 'go':
      return emitGo(model);
    case 'rust':
      return emitRust(model);
    case 'python':
      return emitPython(model, options.pythonStyle ?? 'dataclass');
    default:
      return emitTypeScript(model, options);
  }
}

/** The root is emitted as a plain object type (not an alias) when it's always an object. */
function rootIsObject(model: Model): boolean {
  const k = kinds(model.root);
  return k.object && k.count === 1 && !model.root.null;
}

function nameOf(model: Model, obj: ObjectShape): string {
  return model.nameOf.get(obj) ?? 'Object';
}

const optional = (obj: ObjectShape, count: number) => count < obj.total;

function header(notes: string[], comment: string): string[] {
  return notes.map((n) => `${comment} Note: ${n}`);
}

function finish(lines: string[], blankLines = 1): string {
  const tooMany = new RegExp(`\\n{${blankLines + 2},}`, 'g');
  return `${lines
    .join('\n')
    .replace(tooMany, '\n'.repeat(blankLines + 1))
    .trim()}\n`;
}

// ---------------------------------------------------------------- TypeScript

const TS_IDENT = /^[A-Za-z_$][\w$]*$/;

function emitTypeScript(model: Model, options: JsonToTypesOptions): string {
  const exp = options.tsExport === false ? '' : 'export ';
  const ro = options.tsReadonly ? 'readonly ' : '';
  const decl = options.tsDeclaration ?? 'interface';

  const type = (shape: Shape): string => {
    const k = kinds(shape);
    const parts: string[] = [];
    if (k.boolean) parts.push('boolean');
    if (k.integer || k.number) parts.push('number');
    if (k.string) parts.push('string');
    if (k.array && shape.array) {
      const inner = type(shape.array);
      parts.push(`${ro}${/[ |]/.test(inner) ? `(${inner})` : inner}[]`);
    }
    if (shape.object) parts.push(nameOf(model, shape.object));
    if (shape.null) parts.push('null');
    return parts.length === 0 ? 'unknown' : parts.join(' | ');
  };

  const out = header(model.notes, '//');
  if (out.length) out.push('');
  if (!rootIsObject(model)) out.push(`${exp}type ${model.rootName} = ${type(model.root)};`, '');
  for (const { name, object } of model.types) {
    out.push(decl === 'interface' ? `${exp}interface ${name} {` : `${exp}type ${name} = {`);
    for (const [key, field] of object.fields) {
      const prop = TS_IDENT.test(key) ? key : JSON.stringify(key);
      out.push(`  ${ro}${prop}${optional(object, field.count) ? '?' : ''}: ${type(field.shape)};`);
    }
    out.push(decl === 'interface' ? '}' : '};', '');
  }
  return finish(out);
}

// ---------------------------------------------------------------- Go

const GO_INITIALISMS = new Set([
  'ACL',
  'API',
  'CPU',
  'CSS',
  'DNS',
  'HTML',
  'HTTP',
  'HTTPS',
  'ID',
  'IP',
  'JSON',
  'SQL',
  'SSH',
  'TCP',
  'TLS',
  'UDP',
  'UI',
  'URI',
  'URL',
  'UUID',
  'XML',
]);

function goFieldName(key: string): string {
  const name = words(key)
    .map((w) => (GO_INITIALISMS.has(w.toUpperCase()) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join('');
  return /^\d/.test(name) ? `N${name}` : name;
}

// Characters encoding/json accepts in a struct tag name.
const GO_TAG = /^[\p{L}\p{N}!#$%&()*+\-./:;<=>?@[\]^_{|}~ ]+$/u;

function uniqueIn(used: Set<string>, base: string, sep = ''): string {
  let name = base;
  for (let i = 2; used.has(name); i++) name = `${base}${sep}${i}`;
  used.add(name);
  return name;
}

function pad(text: string, width: number): string {
  return text + ' '.repeat(Math.max(0, width - text.length));
}

function emitGo(model: Model): string {
  const type = (shape: Shape, nilable: boolean): string => {
    const k = kinds(shape);
    if (k.count !== 1) return 'any';
    let base: string;
    if (k.array) return `[]${shape.array ? type(shape.array, shape.array.null) : 'any'}`;
    if (k.boolean) base = 'bool';
    else if (k.integer) base = shape.hugeInt ? 'float64' : 'int64';
    else if (k.number) base = 'float64';
    else if (k.string) base = 'string';
    else base = nameOf(model, shape.object as ObjectShape);
    return nilable ? `*${base}` : base;
  };

  const out = header(model.notes, '//');
  if (out.length) out.push('');
  if (!rootIsObject(model)) out.push(`type ${model.rootName} ${type(model.root, model.root.null)}`, '');
  for (const { name, object } of model.types) {
    out.push(`type ${name} struct {`);
    const used = new Set<string>();
    const rows: Array<{ name: string; type: string; tag: string; note?: string }> = [];
    let i = 0;
    for (const [key, field] of object.fields) {
      i++;
      const opt = optional(object, field.count);
      const fieldName = uniqueIn(used, goFieldName(key) || `Field${i}`);
      const row = { name: fieldName, type: type(field.shape, opt || field.shape.null), tag: '' };
      if (GO_TAG.test(key)) rows.push({ ...row, tag: `\`json:"${key}${opt ? ',omitempty' : ''}"\`` });
      else
        rows.push({
          ...row,
          note: `// JSON key ${JSON.stringify(key)} can't be written in a struct tag; decode it by hand.`,
        });
    }
    const nameWidth = Math.max(0, ...rows.map((r) => r.name.length));
    const typeWidth = Math.max(0, ...rows.map((r) => r.type.length));
    for (const r of rows) {
      if (r.note) out.push(`\t${r.note}`);
      out.push(`\t${pad(r.name, nameWidth)} ${r.tag ? `${pad(r.type, typeWidth)} ${r.tag}` : r.type}`.trimEnd());
    }
    out.push('}', '');
  }
  return finish(out);
}

// ---------------------------------------------------------------- Rust

const RUST_KEYWORDS = new Set(
  (
    'as async await break const continue crate dyn else enum extern false fn for gen if impl in let loop match mod ' +
    'move mut pub ref return self static struct super trait true try type unsafe use where while abstract become ' +
    'box do final macro override priv typeof unsized virtual yield'
  ).split(' '),
);
// Keywords that can't be raw identifiers.
const RUST_NOT_RAW = new Set(['crate', 'self', 'super']);

function rustString(text: string): string {
  let out = '"';
  for (const ch of text) {
    const code = ch.codePointAt(0) as number;
    if (ch === '"' || ch === '\\') out += `\\${ch}`;
    else if (ch === '\n') out += '\\n';
    else if (ch === '\r') out += '\\r';
    else if (ch === '\t') out += '\\t';
    else if (code < 0x20 || code === 0x7f) out += `\\u{${code.toString(16)}}`;
    // Lone surrogates can't appear in a Rust string.
    else if (code >= 0xd800 && code <= 0xdfff) out += '\\u{fffd}';
    else out += ch;
  }
  return `${out}"`;
}

function emitRust(model: Model): string {
  const VALUE = 'serde_json::Value';
  const type = (shape: Shape): string => {
    const k = kinds(shape);
    if (k.count !== 1) return VALUE;
    let base: string;
    if (k.array) base = `Vec<${shape.array ? type(shape.array) : VALUE}>`;
    else if (k.boolean) base = 'bool';
    else if (k.integer) base = shape.hugeInt ? 'f64' : 'i64';
    else if (k.number) base = 'f64';
    else if (k.string) base = 'String';
    else base = nameOf(model, shape.object as ObjectShape);
    return shape.null ? `Option<${base}>` : base;
  };

  const out = header(model.notes, '//');
  if (out.length) out.push('');
  if (model.types.length) out.push('use serde::{Deserialize, Serialize};', '');
  if (!rootIsObject(model)) out.push(`pub type ${model.rootName} = ${type(model.root)};`, '');
  for (const { name, object } of model.types) {
    out.push('#[derive(Debug, Clone, Serialize, Deserialize)]', `pub struct ${name} {`);
    const used = new Set<string>();
    let i = 0;
    for (const [key, field] of object.fields) {
      i++;
      let base = snakeCase(key) || `field_${i}`;
      if (/^\d/.test(base)) base = `_${base}`;
      if (RUST_NOT_RAW.has(base)) base = `${base}_`;
      const ident = uniqueIn(used, base, '_');
      const printed = RUST_KEYWORDS.has(ident) ? `r#${ident}` : ident;
      let t = type(field.shape);
      if (optional(object, field.count) && !t.startsWith('Option<')) t = `Option<${t}>`;
      if (ident !== key) out.push(`    #[serde(rename = ${rustString(key)})]`);
      out.push(`    pub ${printed}: ${t},`);
    }
    out.push('}', '');
  }
  return finish(out);
}

// ---------------------------------------------------------------- Python

const PY_KEYWORDS = new Set(
  (
    'False None True and as assert async await break class continue def del elif else except finally for from ' +
    'global if import in is lambda nonlocal not or pass raise return try while with yield'
  ).split(' '),
);
const PY_IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

function pyIdentifier(key: string, i: number): string {
  if (PY_IDENT.test(key) && !PY_KEYWORDS.has(key)) return key;
  let base = snakeCase(key) || `field_${i}`;
  if (/^\d/.test(base)) base = `_${base}`;
  if (PY_KEYWORDS.has(base)) base = `${base}_`;
  return base;
}

/** Object types in dependency order (children first), as Python evaluates some definitions eagerly. */
function dependencyOrder(model: Model): Model['types'] {
  const byName = new Map(model.types.map((t) => [t.name, t]));
  const done = new Set<string>();
  const order: Model['types'] = [];
  const children = (shape: Shape, acc: string[]) => {
    if (shape.object) acc.push(nameOf(model, shape.object));
    if (shape.array) children(shape.array, acc);
    return acc;
  };
  const visit = (name: string) => {
    if (done.has(name)) return;
    done.add(name);
    const t = byName.get(name);
    if (!t) return;
    for (const field of t.object.fields.values()) for (const child of children(field.shape, [])) visit(child);
    order.push(t);
  };
  for (const t of model.types) visit(t.name);
  return order;
}

function emitPython(model: Model, style: PythonStyle): string {
  const typing = new Set<string>();
  const type = (shape: Shape): string => {
    const k = kinds(shape);
    const parts: string[] = [];
    if (k.boolean) parts.push('bool');
    if (k.integer) parts.push('int');
    if (k.number) parts.push('float');
    if (k.string) parts.push('str');
    if (k.array && shape.array) parts.push(`list[${type(shape.array)}]`);
    if (shape.object) parts.push(nameOf(model, shape.object));
    if (parts.length === 0) {
      if (shape.null) return 'None';
      typing.add('Any');
      return 'Any';
    }
    let base = parts[0] as string;
    if (parts.length > 1) {
      typing.add('Union');
      base = `Union[${parts.join(', ')}]`;
    }
    if (!shape.null) return base;
    typing.add('Optional');
    return `Optional[${base}]`;
  };

  const body: string[] = [];
  for (const { name, object } of dependencyOrder(model)) {
    const fields = [...object.fields.entries()];
    if (style === 'typeddict') {
      typing.add('TypedDict');
      const entries = fields.map(([key, field]) => {
        let t = type(field.shape);
        if (optional(object, field.count)) {
          typing.add('NotRequired');
          t = `NotRequired[${t}]`;
        }
        return { key, t };
      });
      const classSyntax = fields.every(([key]) => PY_IDENT.test(key) && !PY_KEYWORDS.has(key));
      if (classSyntax) {
        body.push(`class ${name}(TypedDict):`);
        for (const e of entries) body.push(`    ${e.key}: ${e.t}`);
        if (entries.length === 0) body.push('    pass');
      } else {
        // Keys that aren't identifiers need the functional syntax.
        body.push(`${name} = TypedDict(${JSON.stringify(name)}, {`);
        for (const e of entries) body.push(`    ${JSON.stringify(e.key)}: ${e.t},`);
        body.push('})');
      }
    } else {
      body.push('@dataclass', `class ${name}:`);
      const used = new Set<string>();
      const rows = fields.map(([key, field], i) => {
        const ident = uniqueIn(used, pyIdentifier(key, i + 1), '_');
        let t = type(field.shape);
        const opt = optional(object, field.count);
        if (opt && !t.startsWith('Optional[') && t !== 'None') {
          typing.add('Optional');
          t = `Optional[${t}]`;
        }
        return { line: `    ${ident}: ${t}${opt ? ' = None' : ''}`, renamed: ident !== key, key, opt };
      });
      // Fields with defaults must come after the others.
      for (const r of [...rows.filter((r) => !r.opt), ...rows.filter((r) => r.opt)]) {
        body.push(r.renamed ? `${r.line}  # JSON key: ${JSON.stringify(r.key)}` : r.line);
      }
      if (rows.length === 0) body.push('    pass');
    }
    body.push('', '');
  }
  if (!rootIsObject(model)) body.push(`${model.rootName} = ${type(model.root)}`);

  const lines = header(model.notes, '#');
  lines.push(
    `# Standard library only (${style === 'dataclass' ? 'dataclasses, typing' : 'typing'}); pydantic isn't needed.`,
    'from __future__ import annotations',
    '',
  );
  if (style === 'dataclass' && model.types.length) lines.push('from dataclasses import dataclass');
  if (typing.size) lines.push(`from typing import ${[...typing].sort().join(', ')}`);
  lines.push('', '');
  return finish([...lines, ...body], 2);
}
