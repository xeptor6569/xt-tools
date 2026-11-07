import { base32nopad, base64 } from '@scure/base';
import { XMLParser } from 'fast-xml-parser';
import { CsvError, parseCsv, writeCsv } from '../../lib/csv.ts';
import { totpAt, type TotpAlgorithm } from '../totp/logic.ts';
import { ToolInputError } from '../types.ts';
import { buildSampleKdbx4, decryptKdbxToXml, isKdbxBytes } from './kdbx.ts';

export { buildSampleKdbx4, isKdbxBytes };

const MAX_TEXT = 10_000_000;
const MAX_FILE_BYTES = 64 * 1024 * 1024;

export type VaultSourceFormat =
  | 'kdbx-4'
  | 'kdbx-3'
  | 'keepass-xml'
  | 'keepass-csv'
  | 'bitwarden-json'
  | 'bitwarden-csv'
  | '1password-json'
  | '1password-csv'
  | 'chrome-csv'
  | 'firefox-csv'
  | 'safari-csv'
  | 'generic-csv';

export type VaultTargetFormat =
  'summary' | 'bitwarden-csv' | 'bitwarden-json' | '1password-csv' | 'keepass-csv' | 'chrome-csv' | 'firefox-csv';

export interface VaultEntry {
  id: string;
  type: 'login' | 'note';
  title: string;
  username: string;
  password: string;
  url: string;
  notes: string;
  folder: string;
  totp: string;
  favorite: boolean;
}

export interface TotpCodeInfo {
  code: string;
  period: number;
  digits: number;
  algorithm: TotpAlgorithm;
  remainingSeconds: number;
}

export interface ParsedVault {
  sourceFormat: VaultSourceFormat;
  entries: VaultEntry[];
  converted: string;
  summary: string;
}

export const TARGET_FORMATS: ReadonlyArray<{
  value: VaultTargetFormat;
  label: string;
  ext: string;
  mime: string;
}> = [
  { value: 'bitwarden-csv', label: 'Bitwarden CSV', ext: 'csv', mime: 'text/csv' },
  { value: 'bitwarden-json', label: 'Bitwarden JSON', ext: 'json', mime: 'application/json' },
  { value: '1password-csv', label: '1Password CSV', ext: 'csv', mime: 'text/csv' },
  { value: 'keepass-csv', label: 'KeePass CSV', ext: 'csv', mime: 'text/csv' },
  { value: 'chrome-csv', label: 'Chrome / Edge / Brave CSV', ext: 'csv', mime: 'text/csv' },
  { value: 'firefox-csv', label: 'Firefox CSV', ext: 'csv', mime: 'text/csv' },
  { value: 'summary', label: 'Readable summary', ext: 'txt', mime: 'text/plain' },
];

function decodeBase32Secret(raw: string): Uint8Array {
  const cleaned = raw
    .trim()
    .replace(/[\s=-]+/g, '')
    .toUpperCase()
    .replace(/0/g, 'O')
    .replace(/1/g, 'I');
  if (cleaned === '' || /[^A-Z2-7]/.test(cleaned)) {
    throw new ToolInputError('TOTP secret is not valid Base32.');
  }
  return base32nopad.decode(cleaned);
}

/**
 * Computes a TOTP code from either an `otpauth://totp/...` URI or a raw Base32 secret.
 */
export function computeEntryTotp(
  totpRaw: string,
  unixSeconds = Math.floor(Date.now() / 1000),
): TotpCodeInfo | undefined {
  const trimmed = totpRaw.trim();
  if (trimmed === '') return undefined;

  let secretText = trimmed;
  let digits = 6;
  let period = 30;
  let algorithm: TotpAlgorithm = 'sha1';

  if (trimmed.toLowerCase().startsWith('otpauth://')) {
    try {
      const url = new URL(trimmed);
      if (url.protocol !== 'otpauth:' || url.host.toLowerCase() !== 'totp') return undefined;
      secretText = url.searchParams.get('secret') ?? '';
      const d = Number(url.searchParams.get('digits') ?? 6);
      if (d === 6 || d === 7 || d === 8) digits = d;
      const p = Number(url.searchParams.get('period') ?? 30);
      if (Number.isInteger(p) && p >= 1 && p <= 300) period = p;
      const alg = (url.searchParams.get('algorithm') ?? 'sha1').toLowerCase().replace(/^hmac-/, '');
      if (alg === 'sha1' || alg === 'sha256' || alg === 'sha512') algorithm = alg;
    } catch {
      return undefined;
    }
  }

  try {
    const secret = decodeBase32Secret(secretText);
    const code = totpAt(secret, unixSeconds, period, digits, algorithm);
    const remainingSeconds = period - (Math.floor(unixSeconds) % period);
    return { code, period, digits, algorithm, remainingSeconds };
  } catch {
    return undefined;
  }
}

function asArray<T>(val: T | T[] | undefined | null): T[] {
  if (val === undefined || val === null) return [];
  return Array.isArray(val) ? val : [val];
}

function textOfXmlValue(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (typeof val === 'object' && '#text' in (val as Record<string, unknown>)) {
    return String((val as Record<string, unknown>)['#text'] ?? '');
  }
  return '';
}

function parseKeePassXml(xml: string, formatLabel: VaultSourceFormat = 'keepass-xml'): ParsedVault {
  const parser = new XMLParser({
    ignoreAttributes: false,
    parseTagValue: false,
    trimValues: false,
  });
  let doc: Record<string, unknown>;
  try {
    doc = parser.parse(xml) as Record<string, unknown>;
  } catch (error) {
    throw new ToolInputError(error instanceof Error ? `Invalid KeePass XML: ${error.message}` : 'Invalid KeePass XML.');
  }

  const kp = doc.KeePassFile as Record<string, unknown> | undefined;
  const root = kp?.Root as Record<string, unknown> | undefined;
  if (!root) {
    throw new ToolInputError('XML does not contain a <KeePassFile><Root> structure.');
  }

  const entries: VaultEntry[] = [];

  const walkGroup = (groupNode: Record<string, unknown>, pathPrefix: string) => {
    const groupName = textOfXmlValue(groupNode.Name).trim();
    const currentFolder =
      pathPrefix && groupName
        ? `${pathPrefix}/${groupName}`
        : groupName && groupName.toLowerCase() !== 'root'
          ? groupName
          : pathPrefix;

    for (const entryNode of asArray(groupNode.Entry as Record<string, unknown> | Record<string, unknown>[])) {
      const fields: Record<string, string> = {};
      for (const strNode of asArray(entryNode.String as Record<string, unknown> | Record<string, unknown>[])) {
        const key = textOfXmlValue(strNode.Key).trim();
        const val = textOfXmlValue(strNode.Value);
        if (key) fields[key] = val;
      }
      const title = fields.Title ?? '';
      const username = fields.UserName ?? '';
      const password = fields.Password ?? '';
      const url = fields.URL ?? '';
      const notes = fields.Notes ?? '';
      const totp = fields.otp ?? fields.TOTP ?? fields['TOTP Seed'] ?? fields['TimeOtp-Secret-Base32'] ?? '';
      if (!title && !username && !password && !url && !notes) continue;
      entries.push({
        id: `kp-${entries.length + 1}`,
        type: !username && !password && !url && notes ? 'note' : 'login',
        title: title || url || username || `Entry ${entries.length + 1}`,
        username,
        password,
        url,
        notes,
        folder: currentFolder,
        totp,
        favorite: false,
      });
    }

    for (const childGroup of asArray(groupNode.Group as Record<string, unknown> | Record<string, unknown>[])) {
      walkGroup(childGroup, currentFolder);
    }
  };

  for (const g of asArray(root.Group as Record<string, unknown> | Record<string, unknown>[])) {
    walkGroup(g, '');
  }

  return finalizeVault(formatLabel, entries, 'summary');
}

function parseJsonExport(text: string): { sourceFormat: VaultSourceFormat; entries: VaultEntry[] } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new ToolInputError(error instanceof Error ? `Invalid JSON export: ${error.message}` : 'Invalid JSON export.');
  }
  if (!data || typeof data !== 'object') {
    throw new ToolInputError('JSON password export must be an object.');
  }
  const obj = data as Record<string, unknown>;
  if (obj.encrypted === true) {
    throw new ToolInputError(
      'This Bitwarden JSON export is encrypted. Export an unencrypted JSON/CSV or use a KeePass .kdbx file.',
    );
  }

  // Bitwarden JSON: { folders?: [{ id, name }], items: [...] }
  if (Array.isArray(obj.items)) {
    const folderMap = new Map<string, string>();
    if (Array.isArray(obj.folders)) {
      for (const f of obj.folders as Array<Record<string, unknown>>) {
        if (typeof f?.id === 'string' && typeof f?.name === 'string') {
          folderMap.set(f.id, f.name);
        }
      }
    }
    const entries: VaultEntry[] = [];
    for (const rawItem of obj.items as Array<Record<string, unknown>>) {
      if (!rawItem || typeof rawItem !== 'object') continue;
      const login = (rawItem.login as Record<string, unknown> | undefined) ?? {};
      const uris = Array.isArray(login.uris) ? (login.uris as Array<Record<string, unknown>>) : [];
      const firstUri =
        typeof uris[0]?.uri === 'string' ? uris[0].uri : typeof rawItem.url === 'string' ? rawItem.url : '';
      const folderId = typeof rawItem.folderId === 'string' ? rawItem.folderId : '';
      const folder = folderMap.get(folderId) ?? (typeof rawItem.folder === 'string' ? rawItem.folder : '');
      const itemType = rawItem.type === 2 ? 'note' : 'login';

      // Also check 1Password JSON item structure (overview / details)
      const overview = (rawItem.overview as Record<string, unknown> | undefined) ?? {};
      const details = (rawItem.details as Record<string, unknown> | undefined) ?? {};
      let opUser = '';
      let opPass = '';
      let opTotp = '';
      if (Array.isArray(details.loginFields)) {
        for (const lf of details.loginFields as Array<Record<string, unknown>>) {
          const designation = String(lf.designation ?? '');
          const value = String(lf.value ?? '');
          if (designation === 'username') opUser = value;
          else if (designation === 'password') opPass = value;
        }
      }
      if (Array.isArray(details.sections)) {
        for (const sec of details.sections as Array<Record<string, unknown>>) {
          for (const field of asArray(sec.fields as Record<string, unknown>[])) {
            const val = field.value as Record<string, unknown> | undefined;
            if (val && typeof val.totp === 'string') opTotp = val.totp;
          }
        }
      }

      const is1PasswordItem = 'overview' in rawItem || 'details' in rawItem;
      const title = String(rawItem.name ?? overview.title ?? `Entry ${entries.length + 1}`);
      const username = String(login.username ?? opUser ?? '');
      const password = String(login.password ?? opPass ?? '');
      const url = String(firstUri || (overview.url ?? ''));
      const notes = String(rawItem.notes ?? details.notesPlain ?? '');
      const totp = String(login.totp ?? opTotp ?? '');

      entries.push({
        id: String(rawItem.id ?? rawItem.uuid ?? `item-${entries.length + 1}`),
        type: itemType,
        title,
        username,
        password,
        url,
        notes,
        folder,
        totp,
        favorite: Boolean(rawItem.favorite),
      });
      if (is1PasswordItem && entries.length === 1) {
        // Continue collecting; mark source below if 1Password keys are present.
      }
    }
    const is1P = (obj.items as Array<Record<string, unknown>>).some((i) => i && ('overview' in i || 'details' in i));
    return {
      sourceFormat: is1P ? '1password-json' : 'bitwarden-json',
      entries,
    };
  }

  // 1Password 1PUX export.data: { accounts: [{ vaults: [{ attrs: { name }, items: [...] }] }] }
  if (Array.isArray(obj.accounts)) {
    const entries: VaultEntry[] = [];
    for (const acc of obj.accounts as Array<Record<string, unknown>>) {
      for (const vault of asArray(acc?.vaults as Array<Record<string, unknown>>)) {
        const vaultAttrs = (vault?.attrs as Record<string, unknown> | undefined) ?? {};
        const vaultName = String(vaultAttrs.name ?? '');
        for (const item of asArray(vault?.items as Array<Record<string, unknown>>)) {
          const overview = (item?.overview as Record<string, unknown> | undefined) ?? {};
          const details = (item?.details as Record<string, unknown> | undefined) ?? {};
          let username = '';
          let password = '';
          let totp = '';
          for (const lf of asArray(details.loginFields as Array<Record<string, unknown>>)) {
            if (lf.designation === 'username') username = String(lf.value ?? '');
            else if (lf.designation === 'password') password = String(lf.value ?? '');
          }
          for (const sec of asArray(details.sections as Array<Record<string, unknown>>)) {
            for (const f of asArray(sec.fields as Array<Record<string, unknown>>)) {
              const v = f.value as Record<string, unknown> | undefined;
              if (v && typeof v.totp === 'string') totp = v.totp;
            }
          }
          entries.push({
            id: String(item.uuid ?? `1p-${entries.length + 1}`),
            type: !username && !password && details.notesPlain ? 'note' : 'login',
            title: String(overview.title ?? `Entry ${entries.length + 1}`),
            username,
            password,
            url: String(overview.url ?? ''),
            notes: String(details.notesPlain ?? ''),
            folder: vaultName,
            totp,
            favorite: Boolean(item.favIndex),
          });
        }
      }
    }
    return { sourceFormat: '1password-json', entries };
  }

  throw new ToolInputError('Unrecognized JSON password export structure (expected Bitwarden or 1Password JSON).');
}

function parseCsvExport(text: string): { sourceFormat: VaultSourceFormat; entries: VaultEntry[] } {
  let rows: string[][];
  try {
    rows = parseCsv(text);
  } catch (error) {
    throw new ToolInputError(error instanceof CsvError ? error.message : 'Invalid CSV password export.');
  }
  const nonEmpty = rows.filter((r) => r.some((cell) => cell.trim() !== ''));
  if (nonEmpty.length === 0) return { sourceFormat: 'generic-csv', entries: [] };

  const headerRow = nonEmpty[0]!;
  const norm = headerRow.map((h) =>
    h
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, ''),
  );

  const has = (...names: string[]) => names.every((n) => norm.includes(n));
  const idxOf = (...candidates: string[]): number => {
    for (const c of candidates) {
      const idx = norm.indexOf(c);
      if (idx >= 0) return idx;
    }
    return -1;
  };

  let sourceFormat: VaultSourceFormat = 'generic-csv';
  if (has('loginusername', 'loginpassword') || has('loginuri', 'loginusername')) {
    sourceFormat = 'bitwarden-csv';
  } else if (has('account', 'loginname', 'password', 'website')) {
    sourceFormat = 'keepass-csv';
  } else if (
    has('url', 'username', 'password', 'httprealm') ||
    has('url', 'username', 'password', 'formactionorigin')
  ) {
    sourceFormat = 'firefox-csv';
  } else if (has('title', 'website', 'username', 'password') && (norm.includes('otpauth') || norm.includes('type'))) {
    sourceFormat = '1password-csv';
  } else if (has('title', 'url', 'username', 'password', 'otpauth')) {
    sourceFormat = 'safari-csv';
  } else if (has('name', 'url', 'username', 'password')) {
    sourceFormat = 'chrome-csv';
  } else if (has('group', 'title', 'username', 'password')) {
    sourceFormat = 'keepass-csv';
  }

  const iTitle = idxOf('name', 'title', 'account', 'service');
  const iUser = idxOf('loginusername', 'username', 'loginname', 'user', 'email');
  const iPass = idxOf('loginpassword', 'password', 'pass', 'secret');
  const iUrl = idxOf('loginuri', 'url', 'website', 'site', 'origin', 'hostname');
  const iNotes = idxOf('notes', 'note', 'comments', 'comment', 'extra');
  const iFolder = idxOf('folder', 'group', 'vault', 'category');
  const iTotp = idxOf('logintotp', 'otpauth', 'totp', 'otp', 'totpseed');
  const iType = idxOf('type');
  const iFav = idxOf('favorite', 'fav');

  if (iTitle < 0 && iUser < 0 && iPass < 0 && iUrl < 0) {
    throw new ToolInputError(
      'CSV header does not contain recognizable password columns (such as name/title, username, password, url).',
    );
  }

  const entries: VaultEntry[] = [];
  for (const row of nonEmpty.slice(1)) {
    const get = (idx: number) => (idx >= 0 ? (row[idx] ?? '').trim() : '');
    const title = get(iTitle);
    const username = get(iUser);
    const password = get(iPass);
    const url = get(iUrl);
    const notes = get(iNotes);
    const folder = get(iFolder);
    const totp = get(iTotp);
    const rawType = get(iType).toLowerCase();
    const fav = get(iFav);

    if (!title && !username && !password && !url && !notes) continue;
    const isNote =
      rawType === 'note' ||
      rawType === '2' ||
      rawType === 'secure note' ||
      (!username && !password && !url && Boolean(notes));

    let fallbackTitle = title || url;
    if (!fallbackTitle && url) {
      fallbackTitle = url;
    }
    if (!fallbackTitle) {
      fallbackTitle = username || `Entry ${entries.length + 1}`;
    }

    entries.push({
      id: `csv-${entries.length + 1}`,
      type: isNote ? 'note' : 'login',
      title: fallbackTitle,
      username,
      password,
      url,
      notes,
      folder,
      totp,
      favorite: fav === '1' || fav.toLowerCase() === 'true',
    });
  }

  return { sourceFormat, entries };
}

export function formatVaultSummary(
  entries: readonly VaultEntry[],
  sourceFormat: VaultSourceFormat,
  unixSeconds?: number,
): string {
  if (entries.length === 0) {
    return `source: ${sourceFormat}\nentries: 0`;
  }
  const lines: string[] = [`source: ${sourceFormat}`, `entries: ${entries.length}`];
  for (const [idx, e] of entries.entries()) {
    const parts = [`#${idx + 1} [${e.type}] ${e.title}`];
    if (e.folder) parts.push(`folder=${e.folder}`);
    if (e.username) parts.push(`user=${e.username}`);
    if (e.url) parts.push(`url=${e.url}`);
    if (e.totp) {
      const otp = computeEntryTotp(e.totp, unixSeconds);
      parts.push(otp ? `totp=${otp.code}` : 'totp=configured');
    }
    lines.push(parts.join(' | '));
  }
  return lines.join('\n');
}

/**
 * Converts normalized vault entries into the requested password manager export format.
 */
export function convertVaultEntries(
  entries: readonly VaultEntry[],
  targetFormat: VaultTargetFormat,
  sourceFormat: VaultSourceFormat = 'generic-csv',
  unixSeconds?: number,
): string {
  if (targetFormat === 'summary') {
    return formatVaultSummary(entries, sourceFormat, unixSeconds);
  }

  if (targetFormat === 'bitwarden-csv') {
    const header = [
      'folder',
      'favorite',
      'type',
      'name',
      'notes',
      'fields',
      'reprompt',
      'login_uri',
      'login_username',
      'login_password',
      'login_totp',
    ];
    const rows = entries.map((e) => [
      e.folder,
      e.favorite ? '1' : '',
      e.type === 'note' ? 'note' : 'login',
      e.title,
      e.notes,
      '',
      '0',
      e.url,
      e.username,
      e.password,
      e.totp,
    ]);
    return writeCsv([header, ...rows]);
  }

  if (targetFormat === 'bitwarden-json') {
    const folderNames = [...new Set(entries.map((e) => e.folder).filter(Boolean))];
    const folders = folderNames.map((name, i) => ({ id: `folder-${i + 1}`, name }));
    const folderIdByName = new Map(folders.map((f) => [f.name, f.id]));
    const items = entries.map((e, i) => ({
      id: e.id || `item-${i + 1}`,
      organizationId: null,
      folderId: e.folder ? (folderIdByName.get(e.folder) ?? null) : null,
      type: e.type === 'note' ? 2 : 1,
      reprompt: 0,
      name: e.title,
      notes: e.notes || null,
      favorite: e.favorite,
      ...(e.type === 'note'
        ? { secureNote: { type: 0 } }
        : {
            login: {
              uris: e.url ? [{ match: null, uri: e.url }] : [],
              username: e.username || null,
              password: e.password || null,
              totp: e.totp || null,
            },
          }),
    }));
    return JSON.stringify({ encrypted: false, folders, items }, null, 2);
  }

  if (targetFormat === '1password-csv') {
    const header = ['Title', 'Website', 'Username', 'Password', 'OTPAuth', 'Notes', 'Type'];
    const rows = entries.map((e) => [
      e.title,
      e.url,
      e.username,
      e.password,
      e.totp,
      e.notes,
      e.type === 'note' ? 'Secure Note' : 'Login',
    ]);
    return writeCsv([header, ...rows]);
  }

  if (targetFormat === 'keepass-csv') {
    const header = ['Account', 'Login Name', 'Password', 'Web Site', 'Comments'];
    const rows = entries.map((e) => [e.title, e.username, e.password, e.url, e.notes]);
    return writeCsv([header, ...rows]);
  }

  if (targetFormat === 'chrome-csv') {
    const header = ['name', 'url', 'username', 'password', 'note'];
    const rows = entries.map((e) => [e.title, e.url, e.username, e.password, e.notes]);
    return writeCsv([header, ...rows]);
  }

  // firefox-csv
  const header = [
    'url',
    'username',
    'password',
    'httpRealm',
    'formActionOrigin',
    'guid',
    'timeCreated',
    'timeLastUsed',
    'timePasswordChanged',
  ];
  const rows = entries.map((e, i) => [
    e.url || 'https://example.com',
    e.username,
    e.password,
    '',
    e.url || '',
    e.id || `guid-${i + 1}`,
    '1700000000000',
    '1700000000000',
    '1700000000000',
  ]);
  return writeCsv([header, ...rows]);
}

function finalizeVault(
  sourceFormat: VaultSourceFormat,
  entries: VaultEntry[],
  targetFormat: VaultTargetFormat,
  unixSeconds?: number,
): ParsedVault {
  const summary = formatVaultSummary(entries, sourceFormat, unixSeconds);
  const converted = convertVaultEntries(entries, targetFormat, sourceFormat, unixSeconds);
  return {
    sourceFormat,
    entries,
    converted,
    summary,
  };
}

export interface InspectVaultOptions {
  fileBytes?: Uint8Array;
  masterPassword?: string;
  keyfileBytes?: Uint8Array;
  targetFormat?: VaultTargetFormat;
  unixSeconds?: number;
}

const KNOWN_HEADERS = new Set(['target', 'format', 'to', 'password', 'time']);

function parseOptionHeaders(input: string): { headers: Record<string, string>; body: string } {
  const lines = input.split(/\r?\n/);
  const headers: Record<string, string> = {};
  let i = 0;
  while (i < lines.length) {
    const match = /^([a-z][a-z0-9-]*)\s*:\s*(.*)$/i.exec(lines[i] ?? '');
    if (!match || !KNOWN_HEADERS.has(match[1]!.toLowerCase())) break;
    headers[match[1]!.toLowerCase()] = (match[2] ?? '').trim();
    i++;
  }
  if (i > 0 && (lines[i] ?? '') === '') i++;
  return { headers, body: lines.slice(i).join('\n') };
}

function parseTargetFormat(raw: string | undefined, fallback: VaultTargetFormat): VaultTargetFormat {
  if (!raw) return fallback;
  const v = raw.trim().toLowerCase();
  if (
    v === 'summary' ||
    v === 'bitwarden-csv' ||
    v === 'bitwarden-json' ||
    v === '1password-csv' ||
    v === 'keepass-csv' ||
    v === 'chrome-csv' ||
    v === 'firefox-csv'
  ) {
    return v;
  }
  throw new ToolInputError(
    `Unknown target format "${raw}". Choose summary, bitwarden-csv, bitwarden-json, 1password-csv, keepass-csv, chrome-csv or firefox-csv.`,
  );
}

/**
 * Parses a password manager export (KDBX binary, KeePass XML/CSV, Bitwarden JSON/CSV,
 * 1Password CSV/JSON, or Chrome/Firefox/Safari CSV) and converts it to the chosen target format.
 */
export async function inspectAndConvertVault(
  inputText: string,
  options: InspectVaultOptions = {},
): Promise<ParsedVault> {
  if (inputText.length > MAX_TEXT) throw new ToolInputError('Input text is too large (maximum 10 MB).');
  if (options.fileBytes && options.fileBytes.length > MAX_FILE_BYTES) {
    throw new ToolInputError('Vault file exceeds the 64 MB limit.');
  }

  const { headers, body } = parseOptionHeaders(inputText);
  const targetFormat = parseTargetFormat(
    headers.target ?? headers.format ?? headers.to,
    options.targetFormat ?? 'summary',
  );
  const masterPassword = headers.password ?? options.masterPassword;
  const unixSeconds = headers.time !== undefined && headers.time !== '' ? Number(headers.time) : options.unixSeconds;
  if (unixSeconds !== undefined && !Number.isFinite(unixSeconds)) {
    throw new ToolInputError('time must be a valid Unix timestamp in seconds.');
  }

  if (options.fileBytes && options.fileBytes.length > 0) {
    if (isKdbxBytes(options.fileBytes)) {
      const { xml, version } = await decryptKdbxToXml(options.fileBytes, masterPassword, options.keyfileBytes);
      const parsed = parseKeePassXml(xml, version.startsWith('3.') ? 'kdbx-3' : 'kdbx-4');
      return finalizeVault(parsed.sourceFormat, parsed.entries, targetFormat, unixSeconds);
    }
    const decodedText = new TextDecoder('utf-8', { fatal: false }).decode(options.fileBytes);
    return await inspectAndConvertVault(decodedText, {
      ...options,
      fileBytes: undefined,
      targetFormat,
      ...(masterPassword !== undefined ? { masterPassword } : {}),
      ...(unixSeconds !== undefined ? { unixSeconds } : {}),
    });
  }

  const content = Object.keys(headers).length > 0 ? body : inputText;
  const trimmed = content.trim();
  if (trimmed === '') {
    return { sourceFormat: 'generic-csv', entries: [], converted: '', summary: '' };
  }

  // Check for Base64-encoded KDBX payload
  if (/^[A-Za-z0-9+/=\s]{32,}$/.test(trimmed) && !trimmed.includes(',')) {
    try {
      const maybeBytes = base64.decode(trimmed.replace(/\s+/g, ''));
      if (isKdbxBytes(maybeBytes)) {
        const { xml, version } = await decryptKdbxToXml(maybeBytes, masterPassword, options.keyfileBytes);
        const parsed = parseKeePassXml(xml, version.startsWith('3.') ? 'kdbx-3' : 'kdbx-4');
        return finalizeVault(parsed.sourceFormat, parsed.entries, targetFormat, unixSeconds);
      }
    } catch (error) {
      if (error instanceof ToolInputError) throw error;
    }
  }

  if (trimmed.startsWith('<')) {
    const parsed = parseKeePassXml(trimmed, 'keepass-xml');
    return finalizeVault(parsed.sourceFormat, parsed.entries, targetFormat, unixSeconds);
  }

  if (trimmed.startsWith('{')) {
    const parsed = parseJsonExport(trimmed);
    return finalizeVault(parsed.sourceFormat, parsed.entries, targetFormat, unixSeconds);
  }

  const parsed = parseCsvExport(trimmed);
  return finalizeVault(parsed.sourceFormat, parsed.entries, targetFormat, unixSeconds);
}

/**
 * Pure text entrypoint for `meta.examples` and simple text conversions.
 */
export async function passwordExportViewer(input: string, options: InspectVaultOptions = {}): Promise<string> {
  const res = await inspectAndConvertVault(input, options);
  return res.converted;
}
