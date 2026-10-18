// Ascii85 (Adobe/btoa variant, with the "z" shortcut for four zero bytes).
// Pure functions; no dependencies.
import { ToolInputError } from '../types.ts';

export function ascii85Encode(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 4) {
    const chunk = bytes.subarray(i, i + 4);
    const padded = new Uint8Array(4);
    padded.set(chunk);
    let n = ((padded[0]! << 24) | (padded[1]! << 16) | (padded[2]! << 8) | padded[3]!) >>> 0;
    if (n === 0 && chunk.length === 4) {
      out += 'z';
      continue;
    }
    const digits = new Array<string>(5);
    for (let d = 4; d >= 0; d--) {
      digits[d] = String.fromCharCode((n % 85) + 33);
      n = Math.floor(n / 85);
    }
    out += digits.slice(0, chunk.length + 1).join('');
  }
  return out;
}

export function ascii85Decode(text: string): Uint8Array {
  let s = text.replace(/\s+/g, '');
  if (s.startsWith('<~')) s = s.slice(2);
  if (s.endsWith('~>')) s = s.slice(0, -2);
  const out: number[] = [];
  let group: number[] = [];
  const flush = (count: number) => {
    while (group.length < 5) group.push(84); // pad with 'u'
    let n = 0;
    for (const c of group) n = n * 85 + c;
    if (n > 0xffffffff) throw new ToolInputError('Invalid Ascii85: a group is out of range.');
    const bytes = [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
    out.push(...bytes.slice(0, count));
    group = [];
  };
  for (const ch of s) {
    if (ch === 'z') {
      if (group.length > 0) throw new ToolInputError('Invalid Ascii85: "z" inside a group.');
      out.push(0, 0, 0, 0);
      continue;
    }
    const code = ch.charCodeAt(0);
    if (code < 33 || code > 117) throw new ToolInputError(`Invalid Ascii85 character "${ch}".`);
    group.push(code - 33);
    if (group.length === 5) flush(4);
  }
  if (group.length === 1) throw new ToolInputError('Invalid Ascii85: the last group is too short.');
  if (group.length > 0) flush(group.length - 1);
  return new Uint8Array(out);
}
