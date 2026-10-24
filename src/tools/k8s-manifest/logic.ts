// Validates multi-document Kubernetes YAML against the bundled JSON schemas
// (public/data/k8s-*.json, built by scripts/datasets/k8s.ts) and adds a few
// optional best-practice warnings for workloads.
import { Validator, type OutputUnit } from '@cfworker/json-schema';
import { isAlias, isMap, isScalar, isSeq, LineCounter, parseAllDocuments, type Document, type Node } from 'yaml';
import { ToolInputError } from '../types.ts';

const MAX_INPUT = 1_000_000;
const MAX_DOCUMENTS = 1000;
const MAX_ISSUES_PER_DOCUMENT = 100;

type Schema = Record<string, unknown>;

export interface K8sKind {
  apiVersion: string;
  kind: string;
  /** Definition name of the root schema for top-level documents. */
  ref: string;
}

export interface K8sSchemas {
  /** Kubernetes release, e.g. "v1.37.1". */
  version: string;
  kinds: K8sKind[];
  definitions: Record<string, Schema>;
}

export interface Issue {
  /** 1-based index of the (non-empty) document. */
  document: number;
  severity: 'error' | 'warning';
  /** Dotted path such as `spec.template.spec.containers[0].image`, or "" for the document. */
  path: string;
  message: string;
  /** 1-based line in the input. */
  line: number;
}

export interface DocumentResult {
  document: number;
  line: number;
  apiVersion?: string;
  kind?: string;
  name?: string;
  status: 'valid' | 'invalid' | 'skipped';
}

export interface Report {
  version: string;
  documents: DocumentResult[];
  issues: Issue[];
  valid: number;
  invalid: number;
  skipped: number;
}

export interface ValidateOptions {
  /** Add best-practice warnings for workloads (default true). */
  bestPractices?: boolean;
}

type Segment = string | number;

// ---------------------------------------------------------------------------
// Schema validation

const validators = new WeakMap<K8sSchemas, Map<string, Validator>>();

function validatorFor(data: K8sSchemas, ref: string): Validator {
  let cache = validators.get(data);
  if (!cache) validators.set(data, (cache = new Map()));
  let v = cache.get(ref);
  if (!v) {
    v = new Validator({ $ref: `#/definitions/${ref}`, definitions: data.definitions }, '4', false);
    cache.set(ref, v);
  }
  return v;
}

/** Decodes a cfworker instance location (`#/a/b~1c/0`) into path segments. */
export function decodeLocation(location: string): string[] {
  const body = location.replace(/^#\/?/, '');
  if (body === '') return [];
  return body.split('/').map((s) => {
    let d = s;
    try {
      d = decodeURI(s);
    } catch {
      // keep the raw segment
    }
    return d.replace(/~1/g, '/').replace(/~0/g, '~');
  });
}

/** Follows a keyword location (which passes through `$ref`s) to the schema it names. */
function schemaAt(root: Schema, definitions: Record<string, Schema>, segments: string[]): Schema | undefined {
  let current: unknown = root;
  for (const seg of segments) {
    if (!current || typeof current !== 'object') return undefined;
    const node = current as Schema;
    if (seg === '$ref') {
      const ref = node.$ref;
      if (typeof ref !== 'string' || !ref.startsWith('#/definitions/')) return undefined;
      current = definitions[decodeLocation(`#/${ref.slice('#/definitions/'.length)}`)[0] ?? ''];
    } else {
      current = node[seg];
    }
  }
  return current && typeof current === 'object' ? (current as Schema) : undefined;
}

function editDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 3) return 99;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(
        (prev[j] ?? 0) + 1,
        (row[j - 1] ?? 0) + 1,
        (prev[j - 1] ?? 0) + (a[i - 1]?.toLowerCase() === b[j - 1]?.toLowerCase() ? 0 : 1),
      );
    }
    prev = row;
  }
  return prev[b.length] ?? 99;
}

function suggest(name: string, candidates: string[]): string | undefined {
  let best: string | undefined;
  let bestScore = name.length <= 4 ? 1 : 2;
  for (const c of candidates) {
    const d = editDistance(name, c);
    if (d <= bestScore) {
      best = c;
      bestScore = d;
    }
  }
  return best;
}

interface RawError {
  segments: Segment[];
  message: string;
  /** Point at the key rather than the value. */
  atKey?: boolean;
}

const TYPE_ERROR = /^Instance type "(\w+)" is invalid\. Expected (.+)\.$/;
const REQUIRED = /^Instance does not have required property "(.*)"\.$/;
const ADDITIONAL = /^Property "(.*)" does not match additional properties schema\.$/;
const ENUM = /^Instance does not match any of (.*)\.$/;

/** Turns cfworker's verbose output into one readable message per real problem. */
function interpret(errors: OutputUnit[], root: Schema, data: K8sSchemas): RawError[] {
  const out: RawError[] = [];
  const seen = new Set<string>();
  const push = (e: RawError) => {
    const key = `${e.segments.join('\u0000')}\u0001${e.message}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(e);
  };
  for (const e of errors) {
    const at = decodeLocation(e.instanceLocation);
    let m: RegExpExecArray | null;
    if (e.keyword === 'type' && (m = TYPE_ERROR.exec(e.error))) {
      const expected = (m[2] ?? '').replace(/"/g, '').split(', ').join(' or ');
      push({ segments: at, message: `Expected ${expected}, got ${m[1]}.` });
    } else if (e.keyword === 'required' && (m = REQUIRED.exec(e.error))) {
      push({ segments: at, message: `Missing required field "${m[1]}".` });
    } else if (e.keyword === 'enum' && (m = ENUM.exec(e.error))) {
      push({ segments: at, message: `Must be one of ${m[1]}.` });
    } else if (e.keyword === 'additionalProperties' && (m = ADDITIONAL.exec(e.error))) {
      const name = m[1] ?? '';
      const loc = decodeLocation(e.keywordLocation);
      const owner = schemaAt(root, data.definitions, loc.slice(0, -1));
      const declared = owner?.properties as Record<string, unknown> | undefined;
      // cfworker also reports declared properties that failed validation here;
      // their own errors are reported separately.
      if (owner?.additionalProperties !== false || (declared && Object.hasOwn(declared, name))) continue;
      const hint = suggest(name, Object.keys(declared ?? {}));
      push({
        segments: [...at, name],
        message: `Unknown field "${name}".${hint ? ` Did you mean "${hint}"?` : ''}`,
        atKey: true,
      });
    } else if (
      !['$ref', 'properties', 'items', 'additionalProperties', 'false', 'allOf', 'anyOf', 'oneOf'].includes(e.keyword)
    ) {
      push({ segments: at, message: e.error });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// YAML helpers

function stripNulls(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripNulls);
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) if (v !== null) out[k] = stripNulls(v);
    return out;
  }
  return value;
}

/** Finds the YAML node (and its key) at a path, falling back to the deepest existing ancestor. */
function locate(doc: Document, segments: Segment[]): { node?: Node | null; key?: Node | null; exact: boolean } {
  let node: unknown = doc.contents;
  let key: Node | null | undefined;
  for (const seg of segments) {
    if (isAlias(node)) node = node.resolve(doc);
    if (isMap(node)) {
      const pair = node.items.find((p) => (isScalar(p.key) ? String(p.key.value) : String(p.key)) === String(seg));
      if (!pair) return { node: node as Node, key, exact: false };
      key = pair.key as Node | null;
      node = pair.value;
    } else if (isSeq(node)) {
      const item = node.items[Number(seg)];
      if (item === undefined) return { node: node as Node, key, exact: false };
      key = undefined;
      node = item;
    } else {
      return { node: node as Node, key, exact: false };
    }
  }
  return { node: node as Node | null, key, exact: true };
}

function lineOf(lc: LineCounter, node: Node | null | undefined, fallback: number): number {
  const offset = node?.range?.[0];
  return offset === undefined ? fallback : lc.linePos(offset).line;
}

export function formatPath(segments: Segment[]): string {
  let out = '';
  for (const s of segments) {
    if (typeof s === 'number' || /^\d+$/.test(s)) out += `[${s}]`;
    else if (/^[A-Za-z_$][\w$-]*$/.test(s)) out += out ? `.${s}` : s;
    else out += `[${JSON.stringify(s)}]`;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Best practices

type Obj = Record<string, unknown>;
const asObj = (v: unknown): Obj | undefined =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : undefined;

/** Where the pod spec lives for each workload kind, and whether probes make sense. */
const POD_SPEC_PATHS: Record<string, { path: string[]; probes: boolean }> = {
  Pod: { path: ['spec'], probes: true },
  Deployment: { path: ['spec', 'template', 'spec'], probes: true },
  StatefulSet: { path: ['spec', 'template', 'spec'], probes: true },
  DaemonSet: { path: ['spec', 'template', 'spec'], probes: true },
  ReplicaSet: { path: ['spec', 'template', 'spec'], probes: true },
  Job: { path: ['spec', 'template', 'spec'], probes: false },
  CronJob: { path: ['spec', 'jobTemplate', 'spec', 'template', 'spec'], probes: false },
};

interface Warning {
  segments: Segment[];
  message: string;
  atKey?: boolean;
}

export function imageTagProblem(image: string): string | undefined {
  if (image.includes('@')) return undefined; // pinned by digest
  const last = image.slice(image.lastIndexOf('/') + 1);
  const colon = last.lastIndexOf(':');
  if (colon < 0) return `Image "${image}" has no tag, so it defaults to :latest. Pin a version or digest.`;
  if (last.slice(colon + 1) === 'latest') return `Image "${image}" uses :latest. Pin a version or digest.`;
  return undefined;
}

export function bestPracticeWarnings(kind: string, obj: Obj): Warning[] {
  const where = POD_SPEC_PATHS[kind];
  if (!where) return [];
  let spec: unknown = obj;
  for (const p of where.path) spec = asObj(spec)?.[p];
  const pod = asObj(spec);
  if (!pod) return [];
  const base: Segment[] = where.path;
  const out: Warning[] = [];

  if (pod.hostNetwork === true) {
    out.push({ segments: [...base, 'hostNetwork'], message: 'hostNetwork: true exposes the node’s network stack.' });
  }
  const podSc = asObj(pod.securityContext);
  const podNonRoot = podSc?.runAsNonRoot === true;

  for (const field of ['initContainers', 'containers'] as const) {
    const list = pod[field];
    if (!Array.isArray(list)) continue;
    list.forEach((raw, i) => {
      const c = asObj(raw);
      if (!c) return;
      const at: Segment[] = [...base, field, i];
      const label = typeof c.name === 'string' ? `Container "${c.name}"` : `Container ${i + 1}`;
      if (typeof c.image === 'string') {
        const problem = imageTagProblem(c.image);
        if (problem) out.push({ segments: [...at, 'image'], message: problem });
      }
      const resources = asObj(c.resources);
      if (!asObj(resources?.requests)) {
        out.push({ segments: at, message: `${label} has no resources.requests, so scheduling can’t plan for it.` });
      }
      if (!asObj(resources?.limits)) {
        out.push({ segments: at, message: `${label} has no resources.limits; it can use unbounded CPU and memory.` });
      }
      if (field === 'containers' && where.probes) {
        if (!c.livenessProbe) out.push({ segments: at, message: `${label} has no livenessProbe.` });
        if (!c.readinessProbe) out.push({ segments: at, message: `${label} has no readinessProbe.` });
      }
      const sc = asObj(c.securityContext);
      if (sc?.privileged === true) {
        out.push({
          segments: [...at, 'securityContext', 'privileged'],
          message: `${label} runs privileged, with full access to the host.`,
        });
      }
      const nonRoot = sc?.runAsNonRoot === undefined ? podNonRoot : sc.runAsNonRoot === true;
      if (!nonRoot) {
        out.push({
          segments: at,
          message: `${label} doesn’t set runAsNonRoot: true (in its or the pod’s securityContext).`,
        });
      }
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Entry point

export function validateManifests(text: string, data: K8sSchemas, options: ValidateOptions = {}): Report {
  if (text.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 1 MB).');
  const { bestPractices = true } = options;
  const lc = new LineCounter();
  const docs = parseAllDocuments(text, {
    lineCounter: lc,
    // Kubernetes reads YAML 1.1 (yes/no booleans, 0644 octal) but keeps
    // timestamps as strings and doesn't parse sexagesimal numbers (22:22).
    version: '1.1',
    customTags: (tags) =>
      tags.filter(
        (t) =>
          typeof t !== 'object' || (t.tag !== 'tag:yaml.org,2002:timestamp' && !('format' in t && t.format === 'TIME')),
      ),
    prettyErrors: true,
    uniqueKeys: true,
    // Warnings would go to the console; errors are reported per document.
    logLevel: 'error',
  });

  const report: Report = { version: data.version, documents: [], issues: [], valid: 0, invalid: 0, skipped: 0 };
  const byKind = new Map(data.kinds.map((k) => [`${k.apiVersion}\u0000${k.kind}`, k]));
  let index = 0;

  for (const doc of docs) {
    const startLine = lineOf(lc, doc.contents ?? undefined, lc.linePos(doc.range[0]).line);
    if (doc.errors.length === 0 && (doc.contents === null || (isScalar(doc.contents) && doc.contents.value === null))) {
      continue; // empty document, e.g. a trailing "---"
    }
    index++;
    if (index > MAX_DOCUMENTS) throw new ToolInputError(`Too many documents (maximum ${MAX_DOCUMENTS}).`);
    const result: DocumentResult = { document: index, line: startLine, status: 'invalid' };
    report.documents.push(result);
    const issue = (severity: Issue['severity'], path: string, message: string, line = startLine) =>
      report.issues.push({ document: index, severity, path, message, line });

    if (doc.errors.length > 0) {
      for (const e of doc.errors.slice(0, 5)) {
        const line = e.linePos?.[0]?.line ?? startLine;
        issue('error', '', `YAML syntax error: ${e.message.split('\n')[0] ?? e.message}`, line);
      }
      report.invalid++;
      continue;
    }

    let value: unknown;
    try {
      value = stripNulls(doc.toJS({ maxAliasCount: 100 }));
    } catch (e) {
      issue('error', '', `YAML could not be read: ${e instanceof Error ? e.message : String(e)}`);
      report.invalid++;
      continue;
    }
    const obj = asObj(value);
    if (!obj) {
      issue('error', '', 'A Kubernetes document must be a mapping with apiVersion and kind.');
      report.invalid++;
      continue;
    }

    const { apiVersion, kind } = obj;
    const name = asObj(obj.metadata)?.name;
    if (typeof apiVersion === 'string') result.apiVersion = apiVersion;
    if (typeof kind === 'string') result.kind = kind;
    if (typeof name === 'string') result.name = name;
    const keyLine = (field: string) => {
      const found = locate(doc, [field]);
      return lineOf(lc, found.exact ? (found.key ?? found.node) : undefined, startLine);
    };

    if (typeof apiVersion !== 'string' || typeof kind !== 'string') {
      const missing = ['apiVersion', 'kind'].filter((f) => typeof obj[f] !== 'string');
      for (const f of missing) {
        issue(
          'error',
          f,
          obj[f] === undefined ? `Missing required field "${f}".` : `"${f}" must be a string.`,
          keyLine(f),
        );
      }
      report.invalid++;
      continue;
    }

    const entry = byKind.get(`${apiVersion}\u0000${kind}`);
    if (!entry) {
      const others = data.kinds.filter((k) => k.kind === kind).map((k) => k.apiVersion);
      issue(
        'warning',
        '',
        others.length > 0
          ? `No schema bundled for ${apiVersion} ${kind} (bundled: ${others.join(', ')}); skipped.`
          : `No schema bundled for ${apiVersion} ${kind} (custom resources aren’t covered); skipped.`,
      );
      result.status = 'skipped';
      report.skipped++;
      continue;
    }

    let errors: RawError[];
    try {
      const root: Schema = { $ref: `#/definitions/${entry.ref}`, definitions: data.definitions };
      errors = interpret(validatorFor(data, entry.ref).validate(obj).errors, root, data);
    } catch (e) {
      // encodeURI() inside the validator rejects field names with lone surrogates.
      if (!(e instanceof URIError)) throw e;
      errors = [{ segments: [], message: 'A field name contains invalid Unicode (a lone surrogate).' }];
    }

    for (const e of errors.slice(0, MAX_ISSUES_PER_DOCUMENT)) {
      const found = locate(doc, e.segments);
      const node = found.exact ? (e.atKey ? (found.key ?? found.node) : found.node) : found.node;
      issue('error', formatPath(e.segments), e.message, lineOf(lc, node, startLine));
    }
    if (errors.length > MAX_ISSUES_PER_DOCUMENT) {
      issue('error', '', `${errors.length - MAX_ISSUES_PER_DOCUMENT} more errors not shown.`);
    }
    if (errors.length === 0) {
      result.status = 'valid';
      report.valid++;
    } else {
      report.invalid++;
    }

    const meta = asObj(obj.metadata);
    if (typeof meta?.name !== 'string' && typeof meta?.generateName !== 'string') {
      issue('warning', 'metadata.name', 'metadata.name (or generateName) is required by the API server.');
    }
    if (bestPractices) {
      for (const w of bestPracticeWarnings(kind, obj)) {
        const found = locate(doc, w.segments);
        const node = found.exact && w.atKey ? (found.key ?? found.node) : found.node;
        issue('warning', formatPath(w.segments), w.message, lineOf(lc, node, startLine));
      }
    }
  }
  return report;
}

/** One-line summary for the output region. */
export function summarize(report: Report): string {
  const n = report.documents.length;
  if (n === 0) return 'No documents to validate yet.';
  const plural = (k: number, word: string) => `${k} ${word}${k === 1 ? '' : 's'}`;
  const warnings = report.issues.filter((i) => i.severity === 'warning').length;
  const tail = [
    report.skipped > 0 ? `${report.skipped} skipped` : '',
    warnings > 0 ? plural(warnings, 'warning') : '',
  ].filter(Boolean);
  const extra = tail.length > 0 ? ` (${tail.join(', ')})` : '';
  if (report.invalid === 0) {
    const checked = n - report.skipped;
    if (checked === 0) return `No documents checked: ${plural(n, 'document')} skipped.`;
    return `${plural(checked, 'document')} valid against Kubernetes ${report.version}${extra}.`;
  }
  return `${report.invalid} of ${plural(n, 'document')} invalid against Kubernetes ${report.version}${extra}.`;
}
