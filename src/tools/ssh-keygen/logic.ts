import { sha256 } from '@noble/hashes/sha2.js';
import { base64, base64nopad } from '@scure/base';
import { ToolInputError } from '../types.ts';
import { bitStringPayload, concatBytes, integerBytes, parseDer, pemEncode } from '../x509-decoder/der.ts';

/** A comment is optional and must stay on one line. */
export function normalizeComment(comment: string): string {
  if (comment.length > 256) throw new ToolInputError('Comment is too long (maximum 256 characters).');
  if (/[\r\n]/.test(comment)) throw new ToolInputError('Comment must be a single line.');
  return comment.trim();
}

function u32(n: number): Uint8Array {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, n);
  return out;
}

function sshString(data: Uint8Array): Uint8Array {
  return concatBytes([u32(data.length), data]);
}

function sshText(text: string): Uint8Array {
  return sshString(new TextEncoder().encode(text));
}

/** OpenSSH mpint: magnitude, with a leading 0x00 when the high bit is set. */
function mpint(bytes: Uint8Array): Uint8Array {
  let i = 0;
  while (i < bytes.length - 1 && bytes[i] === 0) i++;
  let body = bytes.subarray(i);
  if (body.length === 0) body = new Uint8Array([0]);
  if (body[0]! & 0x80) {
    const padded = new Uint8Array(body.length + 1);
    padded.set(body, 1);
    body = padded;
  }
  return sshString(body);
}

function padBlock(data: Uint8Array): Uint8Array {
  const n = 8 - (data.length % 8);
  const out = new Uint8Array(data.length + n);
  out.set(data, 0);
  for (let i = 0; i < n; i++) out[data.length + i] = i + 1;
  return out;
}

function fingerprint(wire: Uint8Array): string {
  return `SHA256:${base64nopad.encode(sha256(wire))}`;
}

function opensshPrivate(publicWire: Uint8Array, secret: Uint8Array, comment: string): string {
  const check = ((secret[0]! << 24) | (secret[1]! << 16) | (secret[2]! << 8) | secret[3]!) >>> 0;
  const pub = publicWire.subarray(publicWire.length - 32);
  const privateKey = concatBytes([secret, pub]);
  const inner = concatBytes([
    u32(check),
    u32(check),
    sshText('ssh-ed25519'),
    sshString(pub),
    sshString(privateKey),
    sshText(comment),
  ]);
  const blob = concatBytes([
    new TextEncoder().encode('openssh-key-v1\0'),
    sshText('none'),
    sshText('none'),
    sshText(''),
    u32(1),
    sshString(publicWire),
    sshString(padBlock(inner)),
  ]);
  return pemEncode('OPENSSH PRIVATE KEY', blob);
}

/**
 * Ed25519 OpenSSH key. `seed` is 32 bytes. The public line, SHA256 fingerprint
 * and unencrypted openssh-key-v1 private key do not need WebCrypto.
 */
export async function sshEd25519(seed: Uint8Array, comment = ''): Promise<string> {
  if (!(seed instanceof Uint8Array) || seed.length !== 32) throw new ToolInputError('Ed25519 needs 32 random bytes.');
  const note = normalizeComment(comment);
  const { ed25519 } = await import('@noble/curves/ed25519.js');
  const publicKey = ed25519.getPublicKey(seed);
  const wire = concatBytes([sshText('ssh-ed25519'), sshString(publicKey)]);
  const line = note === '' ? `ssh-ed25519 ${base64.encode(wire)}` : `ssh-ed25519 ${base64.encode(wire)} ${note}`;
  return `${line}\n${fingerprint(wire)}\n${opensshPrivate(wire, seed, note)}`;
}

function rsaPublic(spki: Uint8Array): { n: Uint8Array; e: Uint8Array } {
  const info = parseDer(spki);
  const bit = info.children[1];
  if (!bit) throw new ToolInputError('WebCrypto returned a public key this tool could not read.');
  const key = parseDer(bitStringPayload(bit));
  const n = key.children[0];
  const e = key.children[1];
  if (!n || !e) throw new ToolInputError('WebCrypto returned a public key this tool could not read.');
  return { n: integerBytes(n), e: integerBytes(e) };
}

/**
 * RSA OpenSSH public key plus a PKCS#8 private PEM. Needs WebCrypto.
 * Ed25519 keeps working when this is unavailable.
 */
export async function sshRsa(comment = '', bits: 2048 | 4096 = 2048): Promise<string> {
  if (bits !== 2048 && bits !== 4096) throw new ToolInputError('Enter 2048 or 4096.');
  const note = normalizeComment(comment);
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new ToolInputError('RSA needs WebCrypto. Ed25519 still works.');
  const key = await subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: bits,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  );
  const spki = new Uint8Array(await subtle.exportKey('spki', key.publicKey));
  const pkcs8 = new Uint8Array(await subtle.exportKey('pkcs8', key.privateKey));
  const { n, e } = rsaPublic(spki);
  const wire = concatBytes([sshText('ssh-rsa'), mpint(e), mpint(n)]);
  const line = note === '' ? `ssh-rsa ${base64.encode(wire)}` : `ssh-rsa ${base64.encode(wire)} ${note}`;
  return `${line}\n${fingerprint(wire)}\n${pemEncode('PRIVATE KEY', pkcs8)}`;
}
