import { base64 } from '@scure/base';
import { ToolInputError } from '../types.ts';

export interface DerNode {
  /** Tag number. Universal tags use the low 5 bits; long tags are assembled. */
  tag: number;
  /** 0 universal, 1 application, 2 context, 3 private. */
  cls: number;
  constructed: boolean;
  bytes: Uint8Array;
  children: DerNode[];
}

function fail(message: string): never {
  throw new ToolInputError(message);
}

export function parseDer(buf: Uint8Array, offset = 0): DerNode {
  const [node, end] = readNode(buf, offset);
  if (offset === 0 && end !== buf.length) fail('Unexpected trailing data after the DER value.');
  return node;
}

function readNode(buf: Uint8Array, offset: number): [DerNode, number] {
  if (offset >= buf.length) fail('DER value is truncated.');
  const tagByte = buf[offset]!;
  const cls = tagByte >> 6;
  const constructed = (tagByte & 0x20) !== 0;
  let tag = tagByte & 0x1f;
  let p = offset + 1;
  if (tag === 0x1f) {
    tag = 0;
    let b: number;
    do {
      if (p >= buf.length) fail('DER tag is truncated.');
      b = buf[p++]!;
      tag = tag * 128 + (b & 0x7f);
    } while (b & 0x80);
  }
  if (p >= buf.length) fail('DER length is truncated.');
  let len = buf[p++]!;
  if (len & 0x80) {
    const n = len & 0x7f;
    if (n === 0 || n > 4) fail('DER length is not supported.');
    len = 0;
    for (let i = 0; i < n; i++) {
      if (p >= buf.length) fail('DER length is truncated.');
      len = len * 256 + buf[p++]!;
    }
  }
  const end = p + len;
  if (end > buf.length) fail('DER value is truncated.');
  const bytes = buf.subarray(p, end);
  const children: DerNode[] = [];
  if (constructed) {
    let c = 0;
    while (c < bytes.length) {
      const [child, next] = readNode(bytes, c);
      children.push(child);
      c = next;
    }
  }
  return [{ tag, cls, constructed, bytes, children }, end];
}

export function decodePem(input: string): { label: string; der: Uint8Array } {
  const match = /-----BEGIN ([A-Z0-9 ]+)-----([\s\S]*?)-----END \1-----/.exec(input);
  if (!match) fail('Paste a PEM block.');
  const body = match[2]!.replace(/[^A-Za-z0-9+/=]/g, '');
  try {
    return { label: match[1]!, der: base64.decode(body) };
  } catch {
    fail('PEM is not valid Base64.');
  }
}

export function oidToString(bytes: Uint8Array): string {
  if (bytes.length === 0) return '';
  const arcs = [Math.floor(bytes[0]! / 40), bytes[0]! % 40];
  let value = 0;
  let pending = false;
  for (let i = 1; i < bytes.length; i++) {
    value = value * 128 + (bytes[i]! & 0x7f);
    pending = true;
    if ((bytes[i]! & 0x80) === 0) {
      arcs.push(value);
      value = 0;
      pending = false;
    }
  }
  if (pending) fail('OID is truncated.');
  return arcs.join('.');
}

export function integerBytes(node: DerNode): Uint8Array {
  let bytes = node.bytes;
  if (bytes.length > 1 && bytes[0] === 0x00) bytes = bytes.subarray(1);
  return bytes;
}

export function integerHex(node: DerNode): string {
  return [...integerBytes(node)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function bitStringPayload(node: DerNode): Uint8Array {
  if (node.bytes.length === 0) fail('BIT STRING is empty.');
  return node.bytes.subarray(1);
}

const OID_NAMES: Record<string, string> = {
  '1.2.840.10045.4.3.1': 'ecdsa-with-SHA1',
  '1.2.840.10045.4.3.2': 'ecdsa-with-SHA256',
  '1.2.840.10045.4.3.3': 'ecdsa-with-SHA384',
  '1.2.840.10045.4.3.4': 'ecdsa-with-SHA512',
  '1.2.840.10045.2.1': 'ecPublicKey',
  '1.2.840.10045.3.1.7': 'prime256v1',
  '1.2.840.113549.1.1.1': 'rsaEncryption',
  '1.2.840.113549.1.1.5': 'sha1WithRSAEncryption',
  '1.2.840.113549.1.1.11': 'sha256WithRSAEncryption',
  '1.2.840.113549.1.1.12': 'sha384WithRSAEncryption',
  '1.2.840.113549.1.1.13': 'sha512WithRSAEncryption',
  '1.3.101.112': 'Ed25519',
  '2.5.4.3': 'CN',
  '2.5.4.6': 'C',
  '2.5.4.7': 'L',
  '2.5.4.8': 'ST',
  '2.5.4.10': 'O',
  '2.5.4.11': 'OU',
  '1.2.840.113549.1.9.1': 'emailAddress',
  '2.5.29.17': 'subjectAltName',
};

export function oidName(oid: string): string {
  return OID_NAMES[oid] ?? oid;
}

export function algorithmName(node: DerNode): string {
  const oidNode = node.children[0];
  if (!oidNode) fail('Algorithm identifier is missing an OID.');
  return oidName(oidToString(oidNode.bytes));
}

function decodeDirectoryString(node: DerNode): string {
  if (node.tag === 30) {
    const codes: number[] = [];
    for (let i = 0; i + 1 < node.bytes.length; i += 2) codes.push((node.bytes[i]! << 8) | node.bytes[i + 1]!);
    return String.fromCharCode(...codes);
  }
  return new TextDecoder().decode(node.bytes);
}

export function formatName(node: DerNode): string {
  const parts: string[] = [];
  for (const set of node.children) {
    for (const atv of set.children) {
      const oid = oidToString(atv.children[0]?.bytes ?? new Uint8Array());
      const value = atv.children[1] ? decodeDirectoryString(atv.children[1]) : '';
      parts.push(`${oidName(oid)}=${value}`);
    }
  }
  return parts.join(', ');
}

export function formatTime(node: DerNode): string {
  const raw = new TextDecoder().decode(node.bytes).trim();
  const zulu = raw.endsWith('Z');
  const core = raw.replace(/Z|[+-]\d{2,4}$/, '');
  let year: string;
  let rest: string;
  if (node.tag === 23) {
    const yy = Number(core.slice(0, 2));
    year = String((yy >= 50 ? 1900 : 2000) + yy);
    rest = core.slice(2);
  } else {
    year = core.slice(0, 4);
    rest = core.slice(4);
  }
  const month = rest.slice(0, 2);
  const day = rest.slice(2, 4);
  const hour = rest.slice(4, 6) || '00';
  const minute = rest.slice(6, 8) || '00';
  const second = rest.slice(8, 10) || '00';
  return `${year}-${month}-${day} ${hour}:${minute}:${second}${zulu ? ' UTC' : ''}`;
}

export function subjectAltNames(extensions: DerNode | undefined): string {
  if (!extensions) return '';
  const seq = extensions.children[0];
  if (!seq) return '';
  const names: string[] = [];
  for (const ext of seq.children) {
    const oid = oidToString(ext.children[0]?.bytes ?? new Uint8Array());
    if (oid !== '2.5.29.17') continue;
    const octet = ext.children[ext.children.length - 1];
    if (!octet) continue;
    const general = parseDer(octet.bytes);
    for (const gn of general.children) {
      if (gn.cls !== 2) continue;
      const text = new TextDecoder().decode(gn.bytes);
      if (gn.tag === 1) names.push(`email:${text}`);
      else if (gn.tag === 2) names.push(`DNS:${text}`);
      else if (gn.tag === 6) names.push(`URI:${text}`);
      else if (gn.tag === 7) names.push(`IP:${[...gn.bytes].join('.')}`);
    }
  }
  return names.join(', ');
}

export function derTag(tag: number, content: Uint8Array): Uint8Array {
  const len = derLen(content.length);
  const out = new Uint8Array(1 + len.length + content.length);
  out[0] = tag;
  out.set(len, 1);
  out.set(content, 1 + len.length);
  return out;
}

function derLen(n: number): Uint8Array {
  if (n < 128) return new Uint8Array([n]);
  const bytes: number[] = [];
  let x = n;
  while (x > 0) {
    bytes.unshift(x & 0xff);
    x = Math.floor(x / 256);
  }
  return new Uint8Array([0x80 | bytes.length, ...bytes]);
}

/** A fresh ArrayBuffer copy. WebCrypto rejects views over SharedArrayBuffer. */
export function copyBytes(bytes: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
}

export function concatBytes(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

export function derSeq(parts: Uint8Array[]): Uint8Array {
  return derTag(0x30, concatBytes(parts));
}

export function derOid(dotted: string): Uint8Array {
  const arcs = dotted.split('.').map((part) => Number(part));
  if (arcs.length < 2 || arcs.some((n) => !Number.isInteger(n) || n < 0)) fail(`Bad OID ${dotted}.`);
  const body = [arcs[0]! * 40 + arcs[1]!];
  for (const arc of arcs.slice(2)) {
    const chunk = [arc & 0x7f];
    let x = Math.floor(arc / 128);
    while (x > 0) {
      chunk.unshift((x & 0x7f) | 0x80);
      x = Math.floor(x / 128);
    }
    body.push(...chunk);
  }
  return derTag(0x06, new Uint8Array(body));
}

export function derInteger(bytes: Uint8Array): Uint8Array {
  let i = 0;
  while (i < bytes.length - 1 && bytes[i] === 0) i++;
  let body = bytes.subarray(i);
  if (body.length === 0) body = new Uint8Array([0]);
  if (body[0]! & 0x80) {
    const padded = new Uint8Array(body.length + 1);
    padded.set(body, 1);
    body = padded;
  }
  return derTag(0x02, body);
}

export function derBitString(payload: Uint8Array): Uint8Array {
  const content = new Uint8Array(payload.length + 1);
  content.set(payload, 1);
  return derTag(0x03, content);
}

export function pemEncode(label: string, der: Uint8Array, width = 64): string {
  const b64 = base64.encode(der);
  const lines: string[] = [];
  for (let i = 0; i < b64.length; i += width) lines.push(b64.slice(i, i + width));
  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----`;
}
