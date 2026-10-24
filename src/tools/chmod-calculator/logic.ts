import { ToolInputError } from '../types.ts';

const MAX_INPUT = 1000;

export const SETUID = 0o4000;
export const SETGID = 0o2000;
export const STICKY = 0o1000;

export type ModeFormat = 'octal' | 'symbolic' | 'ls' | 'chmod-symbolic';

export interface ParsedMode {
  /** Permission and special bits, 0–0o7777. */
  bits: number;
  format: ModeFormat;
  /** File type character from ls-style input ('-', 'd', 'l', …). */
  fileType: string;
  notes: string[];
}

export interface ModeItem {
  label: string;
  value: string;
  note?: string;
  mono?: boolean;
}

export interface ChmodResult extends ParsedMode {
  items: ModeItem[];
}

const FILE_TYPES: Record<string, string> = {
  '-': 'regular file',
  d: 'directory',
  l: 'symbolic link',
  c: 'character device',
  b: 'block device',
  p: 'named pipe',
  s: 'socket',
};

// Bits per class, used by both the parser and the formatter.
const CLASSES = [
  { who: 'u', name: 'owner', shift: 6, special: SETUID },
  { who: 'g', name: 'group', shift: 3, special: SETGID },
  { who: 'o', name: 'others', shift: 0, special: STICKY },
] as const;

/** Parses any supported notation. Returns null for empty input. */
export function parseMode(input: string): ParsedMode | null {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too long for a file mode.');
  const text = input.trim();
  if (text === '') return null;

  const octal = /^(?:0o)?([0-7]+)$/i.exec(text);
  if (octal) {
    const digits = octal[1]!.replace(/^0+(?=\d)/, '');
    const bits = parseInt(digits, 8);
    if (digits.length > 4 || bits > 0o7777) throw new ToolInputError('Octal modes go up to 7777 (four digits).');
    return { bits, format: 'octal', fileType: '-', notes: [] };
  }
  if (/^[0-9]+$/.test(text)) throw new ToolInputError('Octal modes only use the digits 0–7.');

  const ls = /^([-dlcbps])([-rwxsStT]{9})[.+@]?$/.exec(text);
  if (ls) return { bits: parseTriplets(ls[2]!), format: 'ls', fileType: ls[1]!, notes: [] };
  if (/^[-rwxsStT]{9}$/.test(text)) return { bits: parseTriplets(text), format: 'symbolic', fileType: '-', notes: [] };

  if (/^[ugoa]*[-+=]/.test(text)) return parseChmodSymbolic(text);

  throw new ToolInputError(
    'Not a file mode. Try octal (755, 0644, 4755), symbolic (rwxr-xr-x or -rw-r--r--) or chmod syntax (u=rwx,g=rx,o=).',
  );
}

/** Parses the 9 characters of rwxr-xr-x, including s/S/t/T. */
function parseTriplets(s: string): number {
  let bits = 0;
  CLASSES.forEach(({ who, shift, special }, i) => {
    const [r, w, x] = [s[i * 3]!, s[i * 3 + 1]!, s[i * 3 + 2]!];
    if (r !== 'r' && r !== '-') throw new ToolInputError(`Position ${i * 3 + 1} must be r or -.`);
    if (w !== 'w' && w !== '-') throw new ToolInputError(`Position ${i * 3 + 2} must be w or -.`);
    const specialChars = who === 'o' ? 'tT' : 'sS';
    if (x !== 'x' && x !== '-' && !specialChars.includes(x)) {
      throw new ToolInputError(`Position ${i * 3 + 3} must be x, - or ${specialChars.split('').join('/')}.`);
    }
    if (r === 'r') bits |= 4 << shift;
    if (w === 'w') bits |= 2 << shift;
    if (x === 'x' || x === 's' || x === 't') bits |= 1 << shift;
    if (specialChars.includes(x)) bits |= special;
  });
  return bits;
}

/**
 * Applies chmod's symbolic syntax (as GNU chmod does) to a starting mode of
 * 000: clauses like u=rwx,g+rx,o-w, a+X, g=u, +t.
 */
function parseChmodSymbolic(text: string): ParsedMode {
  const notes: string[] = [];
  let mode = 0;
  let relative = false;
  let noWho = false;
  let usedX = false;

  for (const clause of text.split(',')) {
    const m = /^([ugoa]*)((?:[-+=](?:[ugo]|[rwxXst]*))+)$/.exec(clause);
    if (!m) {
      throw new ToolInputError(
        `“${clause.slice(0, 30)}” is not a chmod clause. Use who (u, g, o, a), an operator (+, -, =) and permissions (r, w, x, X, s, t).`,
      );
    }
    const who = m[1]!;
    if (who === '') noWho = true;
    // The bits this clause may touch.
    let affected = 0;
    if (who === '' || who.includes('a')) affected = 0o7777;
    else {
      for (const c of CLASSES) if (who.includes(c.who)) affected |= (7 << c.shift) | c.special;
    }

    for (const action of m[2]!.matchAll(/([-+=])([ugo]|[rwxXst]*)/g)) {
      const op = action[1]!;
      const perms = action[2]!;
      let value = 0;
      if (/^[ugo]$/.test(perms)) {
        // Copy another class's current rwx bits.
        const src = CLASSES.find((c) => c.who === perms)!;
        value = ((mode >> src.shift) & 7) * 0o111;
      } else {
        for (const p of perms) {
          if (p === 'r') value |= 0o444;
          else if (p === 'w') value |= 0o222;
          else if (p === 'x') value |= 0o111;
          else if (p === 'X') {
            usedX = true;
            if (mode & 0o111) value |= 0o111;
          } else if (p === 's') value |= SETUID | SETGID;
          else if (p === 't') value |= STICKY;
        }
      }
      value &= affected;
      if (op === '+') {
        relative = true;
        mode |= value;
      } else if (op === '-') {
        relative = true;
        mode &= ~value;
      } else {
        mode = (mode & ~affected) | value;
      }
    }
  }

  if (relative) notes.push('+ and - change an existing mode; they are applied here to a starting mode of 000.');
  if (noWho) notes.push('Without u, g, o or a, real chmod masks the change with your umask; here it applies to all.');
  if (usedX) notes.push('X adds execute only to directories or files that already have it; this assumes a file.');
  return { bits: mode, format: 'chmod-symbolic', fileType: '-', notes };
}

/** Octal digits, 3 of them or 4 when a special bit is set. */
export function toOctal(bits: number): string {
  return bits > 0o777 ? bits.toString(8).padStart(4, '0') : bits.toString(8).padStart(3, '0');
}

/** rwxr-xr-x, with s/S/t/T for the special bits. */
export function toSymbolic(bits: number): string {
  return CLASSES.map(({ who, shift, special }) => {
    const r = bits & (4 << shift) ? 'r' : '-';
    const w = bits & (2 << shift) ? 'w' : '-';
    const exec = Boolean(bits & (1 << shift));
    let x = exec ? 'x' : '-';
    if (bits & special) {
      const ch = who === 'o' ? 't' : 's';
      x = exec ? ch : ch.toUpperCase();
    }
    return r + w + x;
  }).join('');
}

/** chmod's symbolic form that sets the mode exactly: u=rwx,g=rx,o=rx. */
export function toChmodSymbolic(bits: number): string {
  return CLASSES.map(({ who, shift, special }) => {
    let p = '';
    if (bits & (4 << shift)) p += 'r';
    if (bits & (2 << shift)) p += 'w';
    if (bits & (1 << shift)) p += 'x';
    if (bits & special) p += who === 'o' ? 't' : 's';
    return `${who}=${p}`;
  }).join(',');
}

function list(words: string[]): string {
  if (words.length <= 1) return words.join('');
  return `${words.slice(0, -1).join(', ')} and ${words.at(-1)!}`;
}

/** A plain-English sentence per class plus one per special bit. */
export function describe(bits: number, fileType = '-'): string {
  const dir = fileType === 'd';
  const parts = CLASSES.map(({ name, shift }) => {
    const verbs: string[] = [];
    if (bits & (4 << shift)) verbs.push(dir ? 'list' : 'read');
    if (bits & (2 << shift)) verbs.push(dir ? 'create and delete entries' : 'write');
    if (bits & (1 << shift)) verbs.push(dir ? 'enter' : 'execute');
    const who = name[0]!.toUpperCase() + name.slice(1);
    if (verbs.length) return `${who} can ${list(verbs)}.`;
    return `${who} ${name === 'others' ? 'have' : 'has'} no access.`;
  });
  if (bits & SETUID) {
    parts.push(
      dir ? 'Setuid is set (most systems ignore it on directories).' : 'Setuid: runs with the owner’s privileges.',
    );
  }
  if (bits & SETGID) {
    parts.push(
      dir ? 'Setgid: new entries inherit the directory’s group.' : 'Setgid: runs with the group’s privileges.',
    );
  }
  if (bits & STICKY) {
    parts.push(
      dir
        ? 'Sticky: only an entry’s owner can delete or rename it.'
        : 'Sticky bit set (modern systems ignore it on files).',
    );
  }
  return parts.join(' ');
}

/** Formats bits in the same notation the user typed, for syncing the text box with the grid. */
export function formatLike(format: ModeFormat, bits: number, fileType = '-'): string {
  if (format === 'symbolic') return toSymbolic(bits);
  if (format === 'ls') return fileType + toSymbolic(bits);
  if (format === 'chmod-symbolic') return toChmodSymbolic(bits);
  return toOctal(bits);
}

/** Every representation of a mode, for display. */
export function modeItems(bits: number, fileType = '-'): ModeItem[] {
  const perm = bits & 0o777;
  const name = fileType === 'd' ? 'dir' : 'file';
  const specialNote = bits > 0o777 ? ' umask never sets the special bits.' : '';
  return [
    { label: 'Octal', value: toOctal(bits) },
    { label: 'Symbolic', value: toSymbolic(bits) },
    { label: 'ls -l style', value: fileType + toSymbolic(bits), note: FILE_TYPES[fileType] },
    { label: 'Command (octal)', value: `chmod ${toOctal(bits)} ${name}` },
    { label: 'Command (symbolic)', value: `chmod ${toChmodSymbolic(bits)} ${name}` },
    { label: 'Meaning', value: describe(bits, fileType), mono: false },
    {
      label: 'umask (directories)',
      value: toOctal(0o777 & ~perm),
      note: `New directories start from 777.${specialNote}`,
    },
    perm & 0o111
      ? {
          label: 'umask (files)',
          value: 'None',
          note: 'New files start from 666, so umask can never give them execute bits.',
          mono: false,
        }
      : { label: 'umask (files)', value: toOctal(0o666 & ~perm), note: `New files start from 666.${specialNote}` },
  ];
}

/** Parses the input and returns every representation, or null for empty input. */
export function chmodCalculator(input: string): ChmodResult | null {
  const parsed = parseMode(input);
  if (!parsed) return null;
  return { ...parsed, items: modeItems(parsed.bits, parsed.fileType) };
}
