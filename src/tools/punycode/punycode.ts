// RFC 3492 Punycode, written from the specification (section 6).
import { ToolInputError } from '../types.ts';

const BASE = 36;
const T_MIN = 1;
const T_MAX = 26;
const SKEW = 38;
const DAMP = 700;
const INITIAL_BIAS = 72;
const INITIAL_N = 128;
const MAX_INT = 0x7fffffff;

const digit = (d: number) => String.fromCharCode(d < 26 ? d + 97 : d + 22);
function value(code: number): number {
  if (code >= 48 && code <= 57) return code - 22; // 0-9 → 26-35
  if (code >= 65 && code <= 90) return code - 65; // A-Z
  if (code >= 97 && code <= 122) return code - 97; // a-z
  return BASE;
}

function adapt(delta: number, numPoints: number, first: boolean): number {
  delta = first ? Math.floor(delta / DAMP) : delta >> 1;
  delta += Math.floor(delta / numPoints);
  let k = 0;
  while (delta > ((BASE - T_MIN) * T_MAX) >> 1) {
    delta = Math.floor(delta / (BASE - T_MIN));
    k += BASE;
  }
  return k + Math.floor(((BASE - T_MIN + 1) * delta) / (delta + SKEW));
}

export function encode(input: string): string {
  const points = [...input].map((c) => c.codePointAt(0) ?? 0);
  let output = points
    .filter((cp) => cp < 0x80)
    .map((cp) => String.fromCharCode(cp))
    .join('');
  const basic = output.length;
  let handled = basic;
  if (basic > 0) output += '-';
  let n = INITIAL_N;
  let delta = 0;
  let bias = INITIAL_BIAS;
  while (handled < points.length) {
    const m = Math.min(...points.filter((cp) => cp >= n));
    if (m - n > Math.floor((MAX_INT - delta) / (handled + 1))) throw new ToolInputError('Label is too long to encode.');
    delta += (m - n) * (handled + 1);
    n = m;
    for (const cp of points) {
      if (cp < n && ++delta > MAX_INT) throw new ToolInputError('Label is too long to encode.');
      if (cp !== n) continue;
      let q = delta;
      for (let k = BASE; ; k += BASE) {
        const t = k <= bias ? T_MIN : k >= bias + T_MAX ? T_MAX : k - bias;
        if (q < t) break;
        output += digit(t + ((q - t) % (BASE - t)));
        q = Math.floor((q - t) / (BASE - t));
      }
      output += digit(q);
      bias = adapt(delta, handled + 1, handled === basic);
      delta = 0;
      handled++;
    }
    delta++;
    n++;
  }
  return output;
}

export function decode(input: string): string {
  const output: number[] = [];
  const last = input.lastIndexOf('-');
  for (let j = 0; j < Math.max(last, 0); j++) {
    const code = input.charCodeAt(j);
    if (code >= 0x80) throw new ToolInputError('Invalid Punycode: non-ASCII before the delimiter.');
    output.push(code);
  }
  let n = INITIAL_N;
  let bias = INITIAL_BIAS;
  let i = 0;
  for (let pos = last > 0 ? last + 1 : 0; pos < input.length;) {
    const oldi = i;
    for (let w = 1, k = BASE; ; k += BASE) {
      if (pos >= input.length) throw new ToolInputError('Invalid Punycode: unexpected end.');
      const d = value(input.charCodeAt(pos++));
      if (d >= BASE) throw new ToolInputError('Invalid Punycode: bad character.');
      if (d > Math.floor((MAX_INT - i) / w)) throw new ToolInputError('Invalid Punycode: overflow.');
      i += d * w;
      const t = k <= bias ? T_MIN : k >= bias + T_MAX ? T_MAX : k - bias;
      if (d < t) break;
      w *= BASE - t;
    }
    const len = output.length + 1;
    bias = adapt(i - oldi, len, oldi === 0);
    if (Math.floor(i / len) > MAX_INT - n) throw new ToolInputError('Invalid Punycode: overflow.');
    n += Math.floor(i / len);
    i %= len;
    if (n > 0x10ffff || (n >= 0xd800 && n <= 0xdfff)) throw new ToolInputError('Invalid Punycode: bad code point.');
    output.splice(i++, 0, n);
  }
  return String.fromCodePoint(...output);
}
