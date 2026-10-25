import { bytesToHex } from '@noble/hashes/utils.js';
import { ToolInputError } from '../types.ts';
import { derBitString, derInteger, derOid, derSeq, derTag, pemEncode } from '../x509-decoder/der.ts';

/** Returns `n` cryptographically random bytes. The UI passes crypto.getRandomValues; tests pass a fake. */
export type RandomBytes = (n: number) => Uint8Array;

export type EcCurve = 'ed25519' | 'p256';
export type EcFormat = 'pem' | 'hex';

/** A comment is optional. It is never written inside the PEM. */
export function normalizeComment(comment: string): string {
  if (comment.length > 256) throw new ToolInputError('Comment is too long (maximum 256 characters).');
  if (/[\r\n]/.test(comment)) throw new ToolInputError('Comment must be a single line.');
  return comment.trim();
}

function take(random: RandomBytes, n: number, message: string): Uint8Array {
  const bytes = random(n);
  if (!(bytes instanceof Uint8Array) || bytes.length !== n) throw new ToolInputError(message);
  return bytes;
}

function commentLine(comment: string): string[] {
  return comment === '' ? [] : [`comment: ${comment}`];
}

function ed25519Pkcs8(seed: Uint8Array): Uint8Array {
  return derSeq([derInteger(new Uint8Array([0])), derSeq([derOid('1.3.101.112')]), derTag(0x04, derTag(0x04, seed))]);
}

function ed25519Spki(publicKey: Uint8Array): Uint8Array {
  return derSeq([derSeq([derOid('1.3.101.112')]), derBitString(publicKey)]);
}

function p256Pkcs8(secret: Uint8Array, publicKey: Uint8Array): Uint8Array {
  const ecPrivate = derSeq([
    derInteger(new Uint8Array([1])),
    derTag(0x04, secret),
    derTag(0xa1, derBitString(publicKey)),
  ]);
  return derSeq([
    derInteger(new Uint8Array([0])),
    derSeq([derOid('1.2.840.10045.2.1'), derOid('1.2.840.10045.3.1.7')]),
    derTag(0x04, ecPrivate),
  ]);
}

function p256Spki(publicKey: Uint8Array): Uint8Array {
  return derSeq([derSeq([derOid('1.2.840.10045.2.1'), derOid('1.2.840.10045.3.1.7')]), derBitString(publicKey)]);
}

function pemPair(privateDer: Uint8Array, publicDer: Uint8Array, comment: string): string {
  const body = `${pemEncode('PRIVATE KEY', privateDer)}\n${pemEncode('PUBLIC KEY', publicDer)}`;
  return comment === '' ? body : `comment: ${comment}\n${body}`;
}

/**
 * Ed25519 (32-byte seed) or P-256 (48-byte seed for keygen). `format` is PEM or hex.
 * The comment is shown beside the key and is not part of the PEM.
 */
export async function ecKeygen(random: RandomBytes, curve: EcCurve, format: EcFormat, comment = ''): Promise<string> {
  const note = normalizeComment(comment);
  if (curve === 'ed25519') {
    const { ed25519 } = await import('@noble/curves/ed25519.js');
    const seed = take(random, 32, 'Ed25519 needs 32 random bytes.');
    const publicKey = ed25519.getPublicKey(seed);
    if (format === 'hex') {
      return [
        ...commentLine(note),
        'curve: ed25519',
        `private: ${bytesToHex(seed)}`,
        `public: ${bytesToHex(publicKey)}`,
      ].join('\n');
    }
    return pemPair(ed25519Pkcs8(seed), ed25519Spki(publicKey), note);
  }
  if (curve === 'p256') {
    const { p256 } = await import('@noble/curves/nist.js');
    const seed = take(random, 48, 'P-256 needs 48 random bytes.');
    let secret: Uint8Array;
    try {
      secret = p256.keygen(seed).secretKey;
    } catch (error) {
      throw new ToolInputError(error instanceof Error ? error.message : 'P-256 key generation failed.');
    }
    const publicKey = p256.getPublicKey(secret, false);
    if (format === 'hex') {
      return [
        ...commentLine(note),
        'curve: p256',
        `private: ${bytesToHex(secret)}`,
        `public: ${bytesToHex(publicKey)}`,
      ].join('\n');
    }
    return pemPair(p256Pkcs8(secret, publicKey), p256Spki(publicKey), note);
  }
  throw new ToolInputError('Choose ed25519 or p256.');
}
