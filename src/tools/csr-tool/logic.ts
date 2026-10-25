import { ToolInputError } from '../types.ts';
import {
  algorithmName,
  copyBytes,
  decodePem,
  derBitString,
  derInteger,
  derOid,
  derSeq,
  derTag,
  formatName,
  parseDer,
  pemEncode,
} from '../x509-decoder/der.ts';

const MAX_INPUT = 1_000_000;

const ATTRIBUTES: Record<string, string> = {
  cn: '2.5.4.3',
  o: '2.5.4.10',
  ou: '2.5.4.11',
  c: '2.5.4.6',
  l: '2.5.4.7',
  st: '2.5.4.8',
  emailaddress: '1.2.840.113549.1.9.1',
  e: '1.2.840.113549.1.9.1',
};

/**
 * Decodes a PEM PKCS#10 request. A subject such as `CN=example.com` (no PEM)
 * returns an empty string so the UI can generate from it on demand.
 */
export function csrTool(input: string): string {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 1 MB).');
  if (input.trim() === '') return '';
  if (!input.includes('-----BEGIN')) return '';
  const { label, der } = decodePem(input);
  if (!/CERTIFICATE REQUEST/.test(label)) throw new ToolInputError('Paste a PEM certificate request.');
  const csr = parseDer(der);
  const info = csr.children[0];
  const alg = csr.children[1];
  const subject = info?.children[1];
  if (!info || !alg || !subject) throw new ToolInputError('That is not a PKCS#10 request.');
  return [`subject: ${formatName(subject)}`, `signatureAlgorithm: ${algorithmName(alg)}`].join('\n');
}

function subjectDer(input: string): Uint8Array {
  const text = input.trim();
  if (text === '') throw new ToolInputError('Enter a subject such as CN=example.com, O=Example.');
  if (text.includes('-----BEGIN')) throw new ToolInputError('Paste a subject such as CN=example.com, not a PEM block.');
  const parts = text
    .split(/[,\n]/)
    .map((part) => part.trim())
    .filter((part) => part !== '');
  if (parts.length === 0) throw new ToolInputError('Enter a subject such as CN=example.com, O=Example.');
  const rdns: Uint8Array[] = [];
  for (const part of parts) {
    const eq = part.indexOf('=');
    if (eq <= 0) throw new ToolInputError(`Subject attribute "${part}" must look like CN=example.com.`);
    const key = part.slice(0, eq).trim().toLowerCase();
    const value = part.slice(eq + 1).trim();
    const oid = ATTRIBUTES[key];
    if (!oid) {
      throw new ToolInputError(
        `Unknown subject attribute ${part.slice(0, eq).trim()}. Use CN, O, OU, C, L, ST or emailAddress.`,
      );
    }
    if (value === '') throw new ToolInputError(`Subject attribute ${part.slice(0, eq).trim()} is empty.`);
    const atv = derSeq([derOid(oid), derTag(0x0c, new TextEncoder().encode(value))]);
    rdns.push(derTag(0x31, atv));
  }
  return derSeq(rdns);
}

function ecdsaSignatureDer(raw: Uint8Array): Uint8Array {
  if (raw.length === 64) return derSeq([derInteger(raw.subarray(0, 32)), derInteger(raw.subarray(32))]);
  if (raw[0] === 0x30) return raw;
  throw new ToolInputError('WebCrypto returned an unexpected ECDSA signature.');
}

/** Builds a minimal P-256 PKCS#10 request. Needs WebCrypto. */
export async function generateCsr(subject: string): Promise<string> {
  if (subject.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 1 MB).');
  const name = subjectDer(subject);
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new ToolInputError('Generating a CSR needs WebCrypto. Paste a PEM request to decode one.');
  const key = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);
  const spki = new Uint8Array(await subtle.exportKey('spki', key.publicKey));
  const info = derSeq([derInteger(new Uint8Array([0])), name, spki, derTag(0xa0, new Uint8Array())]);
  const raw = new Uint8Array(await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key.privateKey, copyBytes(info)));
  const csr = derSeq([info, derSeq([derOid('1.2.840.10045.4.3.2')]), derBitString(ecdsaSignatureDer(raw))]);
  return pemEncode('CERTIFICATE REQUEST', csr);
}
