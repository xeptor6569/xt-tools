import { ToolInputError } from '../types.ts';

const MAX_INPUT = 1_000_000;

export interface MimeTypeEntry {
  source?: string;
  compressible?: boolean;
  extensions?: string[];
  charset?: string;
}

export type MimeDb = Record<string, MimeTypeEntry>;

let loading: Promise<MimeDb> | undefined;

/** Load mime-db as its own chunk. The database is cached after the first call. */
export function loadMimeDb(): Promise<MimeDb> {
  loading ??= import('mime-db').then((mod) => mod.default);
  return loading;
}

function classify(input: string): { kind: 'type' | 'ext'; value: string } {
  const q = input.trim().toLowerCase();
  if (/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+/.test(q)) {
    return { kind: 'type', value: (q.split(';')[0] ?? q).trim() };
  }
  const base = q.split(/[/\\]/).pop() ?? q;
  const ext = base.includes('.') ? base.slice(base.lastIndexOf('.') + 1) : base.replace(/^\.+/, '');
  return { kind: 'ext', value: ext };
}

/** Extension to type, or type to the extensions mime-db lists. */
export function lookupMime(db: MimeDb, input: string): string {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 1 MB).');
  if (input.trim() === '') return '';
  const kind = classify(input);
  if (kind.kind === 'type') {
    const entry = db[kind.value];
    if (!entry) return `No type matches "${kind.value}".`;
    const extensions = entry.extensions ?? [];
    if (extensions.length === 0) return `${kind.value}\n(no extensions)`;
    return extensions.map((ext) => `.${ext}`).join(', ');
  }
  if (kind.value === '' || !/^[a-z0-9.+-]+$/.test(kind.value)) return `No type matches "${input.trim()}".`;
  const hits: string[] = [];
  for (const [type, entry] of Object.entries(db)) {
    if (entry.extensions?.includes(kind.value)) hits.push(type);
  }
  hits.sort((a, b) => {
    const ap = db[a]?.extensions?.[0] === kind.value ? 0 : 1;
    const bp = db[b]?.extensions?.[0] === kind.value ? 0 : 1;
    return ap - bp || a.localeCompare(b);
  });
  if (hits.length === 0) return `No type matches ".${kind.value}".`;
  return hits.join('\n');
}

export async function mimeTypes(input: string): Promise<string> {
  return lookupMime(await loadMimeDb(), input);
}
