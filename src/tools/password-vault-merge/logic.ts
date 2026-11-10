import {
  convertVaultEntries,
  parseVaultDocument,
  type VaultDocument,
  type VaultEntry,
  type VaultFolder,
  type VaultSourceFormat,
} from '../password-export-viewer/logic.ts';
import { ToolInputError } from '../types.ts';

const MAX_TEXT = 10_000_000;
const MAX_FILE_BYTES = 64 * 1024 * 1024;

export interface MergeSourceInput {
  name: string;
  text?: string;
  fileBytes?: Uint8Array;
  masterPassword?: string;
}

export interface MergeConflictOption {
  sourceLabel: string;
  password: string;
}

export interface MergeConflict {
  id: string;
  title: string;
  username: string;
  host: string;
  options: MergeConflictOption[];
  defaultPassword: string;
}

export interface MergeSourceStat {
  name: string;
  format: VaultSourceFormat;
  label: string;
  entries: number;
}

export interface MergeReport {
  summary: string;
  bitwardenJson: string;
  bitwardenCsv: string;
  folded: number;
  added: number;
  logins: number;
  passthrough: number;
  conflicts: MergeConflict[];
  sources: MergeSourceStat[];
}

interface TaggedEntry {
  entry: VaultEntry;
  format: VaultSourceFormat;
  label: string;
  rank: number;
  order: number;
}

interface PassthroughBundle {
  items: unknown[];
  folders: VaultFolder[];
}

const SOURCE_RANK: Record<VaultSourceFormat, number> = {
  'bitwarden-json': 0,
  'bitwarden-csv': 0,
  '1password-json': 1,
  '1password-csv': 1,
  'kdbx-4': 2,
  'kdbx-3': 2,
  'keepass-xml': 2,
  'keepass-csv': 2,
  'safari-csv': 3,
  'chrome-csv': 4,
  'firefox-csv': 5,
  'generic-csv': 6,
};

/** Display name for a detected export. Apple Passwords covers iCloud and Safari. */
export function sourceLabel(format: VaultSourceFormat): string {
  switch (format) {
    case 'bitwarden-json':
    case 'bitwarden-csv':
      return 'Bitwarden';
    case '1password-json':
    case '1password-csv':
      return '1Password';
    case 'kdbx-3':
    case 'kdbx-4':
    case 'keepass-xml':
    case 'keepass-csv':
      return 'KeePass';
    case 'safari-csv':
      return 'Apple Passwords';
    case 'chrome-csv':
      return 'Chrome';
    case 'firefox-csv':
      return 'Firefox';
    default:
      return 'CSV';
  }
}

export function importFolderName(format: VaultSourceFormat): string {
  const label = sourceLabel(format);
  return label === 'Bitwarden' ? '' : `Imported from ${label}`;
}

/**
 * Hostname used to decide that two logins are the same account.
 * `www` is ignored, and the path is not part of the key.
 */
export function siteHost(url: string): string {
  const trimmed = url.trim();
  if (trimmed === '') return '';
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(withScheme).hostname
      .replace(/\.$/, '')
      .replace(/^www\./i, '')
      .toLowerCase();
  } catch {
    return '';
  }
}

function entryUrls(entry: VaultEntry): string[] {
  const fromList = entry.urls?.map((url) => url.trim()).filter((url) => url !== '') ?? [];
  if (fromList.length > 0) return fromList;
  return entry.url.trim() ? [entry.url.trim()] : [];
}

function canonicalUrl(url: string): string {
  try {
    const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? url : `https://${url}`;
    const parsed = new URL(withScheme);
    parsed.hostname = parsed.hostname.replace(/^www\./i, '').toLowerCase();
    parsed.hash = '';
    if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) parsed.pathname = parsed.pathname.slice(0, -1);
    return parsed.href.toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

function loginIdentity(entry: VaultEntry): string {
  const user = entry.username.trim().toLowerCase();
  const host =
    entryUrls(entry)
      .map(siteHost)
      .find((value) => value !== '') ?? '';
  if (host) return `host\n${host}\n${user}`;
  const title = entry.title.trim().toLowerCase().replace(/\s+/g, ' ');
  return `title\n${title}\n${user}`;
}

function combineNotes(current: string, incoming: string, label: string): string {
  const next = incoming.trim();
  if (next === '') return current;
  const kept = current.trim();
  if (kept === '' || next.includes(kept)) return incoming;
  if (kept.includes(next)) return current;
  return `${kept}\n\n[from ${label}]\n${next}`;
}

function addUrl(urls: string[], url: string): void {
  const trimmed = url.trim();
  if (trimmed === '') return;
  const key = canonicalUrl(trimmed);
  if (urls.some((existing) => canonicalUrl(existing) === key)) return;
  urls.push(trimmed);
}

/** Splits pasted exports on a line that is only `---`. */
export function splitVaultTexts(input: string): string[] {
  return input
    .split(/\r?\n---\r?\n/)
    .map((part) => part.trim())
    .filter((part) => part !== '');
}

function emptyReport(): MergeReport {
  const summary = ['sources: 0', 'logins: 0', 'folded: 0', 'added: 0', 'conflicts: 0', 'passthrough: 0'].join('\n');
  const bitwardenJson = JSON.stringify({ encrypted: false, folders: [], items: [] }, null, 2);
  return {
    summary,
    bitwardenJson,
    bitwardenCsv: convertVaultEntries([], 'bitwarden-csv'),
    folded: 0,
    added: 0,
    logins: 0,
    passthrough: 0,
    conflicts: [],
    sources: [],
  };
}

function uniqueItemId(used: Set<string>, id: string, fallback: string): string {
  const base = id.trim() || fallback;
  let next = base;
  let n = 2;
  while (used.has(next)) {
    next = `${base}-${n}`;
    n += 1;
  }
  used.add(next);
  return next;
}

function writeBitwardenJson(entries: readonly VaultEntry[], passthrough: readonly PassthroughBundle[]): string {
  const folders: VaultFolder[] = [];
  const folderIds = new Map<string, string>();
  const folderIdFor = (name: string): string | null => {
    const trimmed = name.trim();
    if (trimmed === '') return null;
    const existing = folderIds.get(trimmed);
    if (existing) return existing;
    const id = `folder-${folders.length + 1}`;
    folders.push({ id, name: trimmed });
    folderIds.set(trimmed, id);
    return id;
  };

  const used = new Set<string>();
  const items: unknown[] = entries.map((entry, index) => {
    const id = uniqueItemId(used, entry.id, `item-${index + 1}`);
    const urls = entryUrls(entry);
    return {
      id,
      organizationId: null,
      folderId: folderIdFor(entry.folder),
      type: entry.type === 'note' ? 2 : 1,
      reprompt: 0,
      name: entry.title,
      notes: entry.notes || null,
      favorite: entry.favorite,
      ...(entry.type === 'note'
        ? { secureNote: { type: 0 } }
        : {
            login: {
              uris: urls.map((uri) => ({ match: null, uri })),
              username: entry.username || null,
              password: entry.password || null,
              totp: entry.totp || null,
            },
          }),
    };
  });

  for (const bundle of passthrough) {
    for (const item of bundle.items) {
      if (!item || typeof item !== 'object') continue;
      const raw = item as Record<string, unknown>;
      const originalFolder = typeof raw.folderId === 'string' ? raw.folderId : '';
      const folderName = bundle.folders.find((folder) => folder.id === originalFolder)?.name ?? '';
      const id = uniqueItemId(used, typeof raw.id === 'string' ? raw.id : '', `item-${items.length + 1}`);
      items.push({ ...raw, id, folderId: folderIdFor(folderName) });
    }
  }

  return JSON.stringify({ encrypted: false, folders, items }, null, 2);
}

function mergeDocuments(
  documents: ReadonlyArray<{ name: string; doc: VaultDocument }>,
  choices: Readonly<Record<string, string>>,
): MergeReport {
  if (documents.length === 0) return emptyReport();

  const tagged: TaggedEntry[] = [];
  const passthrough: PassthroughBundle[] = [];
  const sources: MergeSourceStat[] = [];

  for (const [order, source] of documents.entries()) {
    const label = sourceLabel(source.doc.sourceFormat);
    sources.push({
      name: source.name,
      format: source.doc.sourceFormat,
      label,
      entries: source.doc.entries.length,
    });
    if (source.doc.passthroughItems.length > 0) {
      passthrough.push({ items: source.doc.passthroughItems, folders: source.doc.folders });
    }
    for (const entry of source.doc.entries) {
      tagged.push({
        entry,
        format: source.doc.sourceFormat,
        label,
        rank: SOURCE_RANK[source.doc.sourceFormat],
        order,
      });
    }
  }

  const groups = new Map<string, TaggedEntry[]>();
  for (const item of tagged) {
    const key = loginIdentity(item.entry);
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }

  const merged: VaultEntry[] = [];
  const conflicts: MergeConflict[] = [];
  let folded = 0;
  let added = 0;

  for (const [id, group] of groups) {
    group.sort((a, b) => a.rank - b.rank || a.order - b.order);
    const passwordOptions: MergeConflictOption[] = [];
    for (const item of group) {
      const password = item.entry.password;
      if (password.trim() === '') continue;
      if (passwordOptions.some((option) => option.password.trim() === password.trim())) continue;
      passwordOptions.push({ sourceLabel: item.label, password });
    }

    const defaultPassword = passwordOptions[0]?.password ?? '';
    const chosenRaw = choices[id];
    const chosen =
      chosenRaw !== undefined && passwordOptions.some((option) => option.password === chosenRaw)
        ? chosenRaw
        : defaultPassword;
    if (passwordOptions.length > 1) {
      const first = group[0]!.entry;
      const host =
        entryUrls(first)
          .map(siteHost)
          .find((value) => value !== '') ?? '';
      conflicts.push({
        id,
        title: group.map((item) => item.entry.title.trim()).find((title) => title !== '') ?? '',
        username: group.map((item) => item.entry.username.trim()).find((user) => user !== '') ?? '',
        host,
        options: passwordOptions,
        defaultPassword,
      });
    }

    const absorbed = group.filter((item) => {
      const password = item.entry.password.trim();
      return password === '' || password === chosen.trim();
    });
    folded += Math.max(0, absorbed.length - 1);

    const hasBitwarden = group.some((item) => item.rank === 0);
    let title = '';
    let username = '';
    let notes = '';
    let totp = '';
    let folder = '';
    let favorite = false;
    let type: VaultEntry['type'] = 'note';
    const urls: string[] = [];
    for (const item of group) {
      if (!title && item.entry.title.trim()) title = item.entry.title;
      if (!username && item.entry.username.trim()) username = item.entry.username;
      if (!totp && item.entry.totp.trim()) totp = item.entry.totp;
      if (!folder && item.entry.folder.trim()) folder = item.entry.folder;
      if (item.entry.favorite) favorite = true;
      if (item.entry.type === 'login') type = 'login';
      notes = combineNotes(notes, item.entry.notes, item.label);
      for (const url of entryUrls(item.entry)) addUrl(urls, url);
    }
    if (!hasBitwarden && folder.trim() === '') folder = importFolderName(group[0]!.format);
    if (!hasBitwarden && type === 'login') added += 1;

    merged.push({
      id: group[0]!.entry.id,
      type,
      title: title || urls[0] || username || 'Untitled',
      username,
      password: chosen,
      url: urls[0] ?? '',
      ...(urls.length > 0 ? { urls } : {}),
      notes,
      folder,
      totp,
      favorite,
    });
  }

  const logins = merged.filter((entry) => entry.type === 'login').length;
  const passthroughCount = passthrough.reduce((sum, bundle) => sum + bundle.items.length, 0);
  const lines = [
    `sources: ${sources.length}`,
    `logins: ${logins}`,
    `folded: ${folded}`,
    `added: ${added}`,
    `conflicts: ${conflicts.length}`,
    `passthrough: ${passthroughCount}`,
  ];
  for (const conflict of conflicts) {
    const where = conflict.host || conflict.title;
    lines.push(`conflict: ${where} | ${conflict.username} | choices=${conflict.options.length}`);
  }
  if (passthroughCount > 0) lines.push('passthrough items are included in the JSON download only');

  return {
    summary: lines.join('\n'),
    bitwardenJson: writeBitwardenJson(merged, passthrough),
    bitwardenCsv: convertVaultEntries(merged, 'bitwarden-csv'),
    folded,
    added,
    logins,
    passthrough: passthroughCount,
    conflicts,
    sources,
  };
}

/**
 * Parses each export and folds logins that share a site and username.
 * Bitwarden wins when both sides have a value. A different password stays a conflict.
 */
export async function mergeVaultSources(
  sources: readonly MergeSourceInput[],
  choices: Readonly<Record<string, string>> = {},
): Promise<MergeReport> {
  const documents: Array<{ name: string; doc: VaultDocument }> = [];
  for (const [index, source] of sources.entries()) {
    const name = source.name.trim() || `Export ${index + 1}`;
    const text = source.text ?? '';
    if (text.length > MAX_TEXT) throw new ToolInputError(`${name}: input text is too large (maximum 10 MB).`);
    if (source.fileBytes && source.fileBytes.byteLength > MAX_FILE_BYTES) {
      throw new ToolInputError(`${name}: vault file exceeds the 64 MB limit.`);
    }
    if (text.trim() === '' && (!source.fileBytes || source.fileBytes.byteLength === 0)) continue;
    try {
      const doc = await parseVaultDocument(text, {
        ...(source.fileBytes ? { fileBytes: source.fileBytes } : {}),
        ...(source.masterPassword ? { masterPassword: source.masterPassword } : {}),
      });
      documents.push({ name, doc });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not read this export.';
      throw new ToolInputError(message.startsWith(`${name}:`) ? message : `${name}: ${message}`);
    }
  }
  return mergeDocuments(documents, choices);
}

/**
 * Merges exports pasted as text, separated by a line containing only `---`.
 * Returns the summary. The JSON and CSV downloads come from `mergeVaultSources`.
 */
export async function passwordVaultMerge(
  input: string,
  choices: Readonly<Record<string, string>> = {},
): Promise<string> {
  if (input.length > MAX_TEXT) throw new ToolInputError('Input is too large (maximum 10 MB).');
  const parts = splitVaultTexts(input);
  if (parts.length === 0) return emptyReport().summary;
  const report = await mergeVaultSources(
    parts.map((text, index) => ({ name: `Pasted export ${index + 1}`, text })),
    choices,
  );
  return report.summary;
}
