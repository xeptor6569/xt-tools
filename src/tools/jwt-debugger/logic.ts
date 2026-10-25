import { hmac } from '@noble/hashes/hmac.js';
import { sha256, sha384, sha512 } from '@noble/hashes/sha2.js';
import { hexToBytes } from '@noble/hashes/utils.js';
import { base64urlnopad } from '@scure/base';
import { ToolInputError } from '../types.ts';
import { bitStringPayload, decodePem, integerBytes, oidToString, parseDer, type DerNode } from '../x509-decoder/der.ts';

const MAX_INPUT = 1_000_000;

const HASHES = { sha256, sha384, sha512 } as const;
const HMAC_ALGS: Record<string, keyof typeof HASHES> = { HS256: 'sha256', HS384: 'sha384', HS512: 'sha512' };
const RSA_ALGS: Record<string, keyof typeof HASHES> = { RS256: 'sha256', RS384: 'sha384', RS512: 'sha512' };
const EC_ALGS: Record<string, 'P-256' | 'P-384'> = { ES256: 'P-256', ES384: 'P-384' };

/** DigestInfo prefixes from RFC 8017 (PKCS#1), excluding the hash itself. */
const DIGEST_INFO: Record<keyof typeof HASHES, Uint8Array> = {
  sha256: hexToBytes('3031300d060960864801650304020105000420'),
  sha384: hexToBytes('3041300d060960864801650304020205000430'),
  sha512: hexToBytes('3051300d060960864801650304020305000440'),
};

const CURVE_OID: Record<string, 'P-256' | 'P-384'> = {
  '1.2.840.10045.3.1.7': 'P-256',
  '1.3.132.0.34': 'P-384',
};

interface Materials {
  hmac?: Uint8Array;
  rsa?: { n: Uint8Array; e: Uint8Array };
  ec?: { crv: 'P-256' | 'P-384'; point: Uint8Array };
  okp?: Uint8Array;
}

function headersAndBody(input: string): { headers: Record<string, string>; body: string } {
  const known = new Set(['mode', 'alg', 'secret', 'secret-hex']);
  const lines = input.split(/\r?\n/);
  const headers: Record<string, string> = {};
  let i = 0;
  while (i < lines.length) {
    const match = /^([a-z][a-z0-9-]*)\s*:\s*(.*)$/i.exec(lines[i] ?? '');
    if (!match || !known.has(match[1]!.toLowerCase())) break;
    headers[match[1]!.toLowerCase()] = match[2] ?? '';
    i++;
  }
  if (i > 0 && (lines[i] ?? '') === '') i++;
  return { headers, body: lines.slice(i).join('\n') };
}

function extractPem(body: string): { pem?: string; rest: string } {
  const match = /-----BEGIN [A-Z0-9 ]+-----[\s\S]*?-----END [A-Z0-9 ]+-----/.exec(body);
  if (!match) return { rest: body };
  const rest = `${body.slice(0, match.index)}${body.slice(match.index + match[0].length)}`.trim();
  return { pem: match[0], rest };
}

function extractJwk(body: string): { jwk?: Record<string, unknown>; rest: string } {
  const start = body.indexOf('{');
  if (start < 0) return { rest: body };
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < body.length; i++) {
    const c = body[i]!;
    if (inString) {
      if (escape) escape = false;
      else if (c === '\\') escape = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth !== 0) continue;
      const slice = body.slice(start, i + 1);
      const rest = `${body.slice(0, start)}${body.slice(i + 1)}`.trim();
      if (!/"kty"/.test(slice)) return { rest: body };
      if (!/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/.test(rest)) return { rest: body };
      try {
        const obj = JSON.parse(slice) as Record<string, unknown>;
        if (!obj || typeof obj.kty !== 'string') return { rest: body };
        return { jwk: obj, rest };
      } catch {
        return { rest: body };
      }
    }
  }
  return { rest: body };
}

function b64urlDecode(segment: string): Uint8Array {
  const clean = segment.replace(/=+$/, '');
  if (clean === '') return new Uint8Array();
  try {
    return base64urlnopad.decode(clean);
  } catch {
    throw new ToolInputError('A JWT segment is not valid base64url.');
  }
}

function b64urlEncode(bytes: Uint8Array): string {
  return base64urlnopad.encode(bytes);
}

function canonicalAlg(alg: string): string {
  const upper = alg.trim().toUpperCase();
  return upper === 'EDDSA' ? 'EdDSA' : upper;
}

function showJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function block(header: unknown, payload: unknown): string {
  return `header:\n${JSON.stringify(header, null, 2)}\npayload:\n${JSON.stringify(payload, null, 2)}`;
}

function parseHexKey(hex: string): Uint8Array {
  const clean = hex.trim().replace(/\s+/g, '');
  if (clean.length % 2 !== 0 || /[^0-9a-f]/i.test(clean)) {
    throw new ToolInputError('secret-hex must be an even number of hex digits.');
  }
  return hexToBytes(clean);
}

function hmacKey(headers: Record<string, string>): Uint8Array | undefined {
  if (headers['secret-hex'] !== undefined && headers['secret-hex'] !== '') return parseHexKey(headers['secret-hex']);
  if (headers.secret !== undefined) return new TextEncoder().encode(headers.secret);
  return undefined;
}

function jwkBytes(value: unknown, name: string): Uint8Array {
  if (typeof value !== 'string' || value === '') throw new ToolInputError(`JWK is missing ${name}.`);
  return b64urlDecode(value);
}

function jwkMaterial(jwk: Record<string, unknown>): Materials {
  const kty = jwk.kty;
  if (kty === 'oct') return { hmac: jwkBytes(jwk.k, 'k') };
  if (kty === 'RSA') return { rsa: { n: jwkBytes(jwk.n, 'n'), e: jwkBytes(jwk.e, 'e') } };
  if (kty === 'EC') {
    const crv = jwk.crv === 'P-256' || jwk.crv === 'P-384' ? jwk.crv : undefined;
    if (!crv) throw new ToolInputError('EC JWK curve must be P-256 or P-384.');
    const x = jwkBytes(jwk.x, 'x');
    const y = jwkBytes(jwk.y, 'y');
    const point = new Uint8Array(1 + x.length + y.length);
    point[0] = 4;
    point.set(x, 1);
    point.set(y, 1 + x.length);
    return { ec: { crv, point } };
  }
  if (kty === 'OKP') {
    if (jwk.crv !== 'Ed25519') throw new ToolInputError('OKP JWK curve must be Ed25519.');
    return { okp: jwkBytes(jwk.x, 'x') };
  }
  throw new ToolInputError('Unsupported JWK. Use oct, RSA, EC or OKP.');
}

function rsaFromSequence(node: DerNode): { n: Uint8Array; e: Uint8Array } {
  const n = node.children[0];
  const e = node.children[1];
  if (!n || !e) throw new ToolInputError('RSA public key is missing a modulus or exponent.');
  return { n: integerBytes(n), e: integerBytes(e) };
}

function pemMaterial(pem: string): Materials {
  const { label, der } = decodePem(pem);
  if (label === 'RSA PUBLIC KEY') return { rsa: rsaFromSequence(parseDer(der)) };
  if (label !== 'PUBLIC KEY') throw new ToolInputError('Paste a PUBLIC KEY or RSA PUBLIC KEY PEM, or a JWK.');
  const spki = parseDer(der);
  const alg = spki.children[0];
  const bit = spki.children[1];
  const oidNode = alg?.children[0];
  if (!alg || !bit || !oidNode) throw new ToolInputError('Public key is not a SubjectPublicKeyInfo.');
  const oid = oidToString(oidNode.bytes);
  const raw = bitStringPayload(bit);
  if (oid === '1.2.840.113549.1.1.1') return { rsa: rsaFromSequence(parseDer(raw)) };
  if (oid === '1.2.840.10045.2.1') {
    const curveOid = alg.children[1] ? oidToString(alg.children[1].bytes) : '';
    const crv = CURVE_OID[curveOid];
    if (!crv) throw new ToolInputError('EC public key must be P-256 or P-384.');
    return { ec: { crv, point: raw } };
  }
  if (oid === '1.3.101.112') return { okp: raw };
  throw new ToolInputError(`Unsupported public key algorithm ${oid}.`);
}

function materialsOf(headers: Record<string, string>, pem?: string, jwk?: Record<string, unknown>): Materials {
  const out: Materials = {};
  const secret = hmacKey(headers);
  if (secret) out.hmac = secret;
  if (jwk) Object.assign(out, jwkMaterial(jwk));
  if (pem) Object.assign(out, pemMaterial(pem));
  return out;
}

function hasMaterial(m: Materials): boolean {
  return m.hmac !== undefined || m.rsa !== undefined || m.ec !== undefined || m.okp !== undefined;
}

function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

function os2ip(bytes: Uint8Array): bigint {
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) + BigInt(byte);
  return value;
}

function i2osp(value: bigint, length: number): Uint8Array | undefined {
  if (value < 0n) return undefined;
  const out = new Uint8Array(length);
  let x = value;
  for (let i = length - 1; i >= 0; i--) {
    out[i] = Number(x & 0xffn);
    x >>= 8n;
  }
  return x === 0n ? out : undefined;
}

function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  let result = 1n;
  let b = base % mod;
  let e = exp;
  while (e > 0n) {
    if (e & 1n) result = (result * b) % mod;
    e >>= 1n;
    b = (b * b) % mod;
  }
  return result;
}

/** RSASSA-PKCS1-v1.5 verify (RFC 8017) with BigInt, so it does not need WebCrypto. */
function rsaVerify(
  hash: keyof typeof HASHES,
  message: Uint8Array,
  sig: Uint8Array,
  n: Uint8Array,
  e: Uint8Array,
): boolean {
  const digest = HASHES[hash](message);
  const prefix = DIGEST_INFO[hash];
  const k = n.length;
  const tLen = prefix.length + digest.length;
  if (k < tLen + 11) return false;
  let signature = sig;
  if (signature.length > k) return false;
  if (signature.length < k) {
    const padded = new Uint8Array(k);
    padded.set(signature, k - signature.length);
    signature = padded;
  }
  const modulus = os2ip(n);
  const s = os2ip(signature);
  if (s >= modulus) return false;
  const em = i2osp(modPow(s, os2ip(e), modulus), k);
  if (!em) return false;
  const expected = new Uint8Array(k);
  expected[1] = 0x01;
  expected.fill(0xff, 2, k - tLen - 1);
  expected[k - tLen - 1] = 0x00;
  expected.set(prefix, k - tLen);
  expected.set(digest, k - digest.length);
  return equalBytes(em, expected);
}

async function ecVerify(
  crv: 'P-256' | 'P-384',
  message: Uint8Array,
  sig: Uint8Array,
  point: Uint8Array,
): Promise<boolean> {
  const size = crv === 'P-256' ? 32 : 48;
  if (point.length !== 1 + size * 2 || point[0] !== 4 || sig.length !== size * 2) return false;
  const { p256, p384 } = await import('@noble/curves/nist.js');
  const curve = crv === 'P-256' ? p256 : p384;
  try {
    return curve.verify(sig, message, point, { prehash: true, lowS: false });
  } catch {
    return false;
  }
}

async function edVerify(message: Uint8Array, sig: Uint8Array, key: Uint8Array): Promise<boolean> {
  if (key.length !== 32 || sig.length !== 64) return false;
  const { ed25519 } = await import('@noble/curves/ed25519.js');
  try {
    return ed25519.verify(sig, message, key);
  } catch {
    return false;
  }
}

async function verifyAlg(
  alg: string,
  message: Uint8Array,
  sig: Uint8Array,
  keys: Materials,
): Promise<boolean | 'unsupported'> {
  const hmacHash = HMAC_ALGS[alg];
  if (hmacHash) {
    if (!keys.hmac) return false;
    return equalBytes(hmac(HASHES[hmacHash], keys.hmac, message), sig);
  }
  const rsaHash = RSA_ALGS[alg];
  if (rsaHash) {
    if (!keys.rsa) return false;
    return rsaVerify(rsaHash, message, sig, keys.rsa.n, keys.rsa.e);
  }
  const crv = EC_ALGS[alg];
  if (crv) {
    if (!keys.ec || keys.ec.crv !== crv) return false;
    return ecVerify(crv, message, sig, keys.ec.point);
  }
  if (alg === 'EdDSA') {
    if (!keys.okp) return false;
    return edVerify(message, sig, keys.okp);
  }
  return 'unsupported';
}

function sign(headers: Record<string, string>, body: string): string {
  const payload = body.trim();
  if (payload === '') throw new ToolInputError('Enter a payload to sign.');
  const alg = canonicalAlg(headers.alg ?? 'HS256');
  if (alg === 'NONE') throw new ToolInputError('Refusing to sign with the none algorithm.');
  const hash = HMAC_ALGS[alg];
  if (!hash) {
    throw new ToolInputError(
      'Signing supports HS256, HS384 and HS512. Paste a compact JWT to verify other algorithms.',
    );
  }
  const key = hmacKey(headers);
  if (!key) throw new ToolInputError('Add a secret: line (UTF-8) or a secret-hex: line.');
  const headerJson = `{"alg":"${alg}","typ":"JWT"}`;
  const h = b64urlEncode(new TextEncoder().encode(headerJson));
  const p = b64urlEncode(new TextEncoder().encode(payload));
  const mac = hmac(HASHES[hash], key, new TextEncoder().encode(`${h}.${p}`));
  const signature = b64urlEncode(mac);
  return [
    `alg: ${alg}`,
    `token: ${h}.${p}.${signature}`,
    `signature: ${signature}`,
    `header:\n${JSON.stringify(JSON.parse(headerJson), null, 2)}`,
    `payload:\n${JSON.stringify(showJson(payload), null, 2)}`,
  ].join('\n');
}

async function verify(
  headers: Record<string, string>,
  body: string,
  pem?: string,
  jwk?: Record<string, unknown>,
): Promise<string> {
  const token = body.trim();
  if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*$/.test(token)) {
    throw new ToolInputError('Paste a compact JWT (header.payload.signature).');
  }
  const [h, p, s] = token.split('.') as [string, string, string];
  let header: unknown;
  try {
    header = JSON.parse(new TextDecoder().decode(b64urlDecode(h)));
  } catch (error) {
    if (error instanceof ToolInputError) throw error;
    throw new ToolInputError('JWT header is not JSON.');
  }
  if (!header || typeof header !== 'object' || Array.isArray(header)) {
    throw new ToolInputError('JWT header must be a JSON object.');
  }
  const headerObj = header as Record<string, unknown>;
  const payloadText = new TextDecoder().decode(b64urlDecode(p));
  const shown = block(headerObj, showJson(payloadText));
  const rawAlg = typeof headerObj.alg === 'string' ? headerObj.alg : '';
  if (rawAlg.trim().toLowerCase() === 'none') {
    return `alg: none\nvalid: no\nunsafe: alg none is not accepted\n${shown}`;
  }
  if (rawAlg.trim() === '') throw new ToolInputError('JWT header is missing alg.');
  const alg = canonicalAlg(rawAlg);
  let sig: Uint8Array;
  try {
    sig = b64urlDecode(s);
  } catch {
    return `alg: ${alg}\nvalid: no\n${shown}`;
  }
  const keys = materialsOf(headers, pem, jwk);
  if (!hasMaterial(keys)) return `alg: ${alg}\nvalid: not checked\n${shown}`;
  const result = await verifyAlg(alg, new TextEncoder().encode(`${h}.${p}`), sig, keys);
  if (result === 'unsupported') return `alg: ${alg}\nvalid: no\nnote: this algorithm is not supported\n${shown}`;
  return `alg: ${alg}\nvalid: ${result ? 'yes' : 'no'}\n${shown}`;
}

/**
 * Decodes a compact JWT. Signs HS256/384/512 when the text is a payload plus a
 * secret. Verifies HMAC with that secret, and RS/ES/EdDSA when a PEM or JWK is
 * included. `alg: none` is never accepted.
 */
export async function jwtDebugger(input: string): Promise<string> {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 1 MB).');
  if (input.trim() === '') return '';
  const { headers, body } = headersAndBody(input);
  const { pem, rest: withoutPem } = extractPem(body);
  const { jwk, rest } = extractJwk(withoutPem);
  const requested = headers.mode?.trim().toLowerCase();
  const looksLikeJwt = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*$/.test(rest.trim());
  const mode = requested === 'sign' || requested === 'verify' ? requested : looksLikeJwt ? 'verify' : 'sign';
  if (mode === 'sign') return sign(headers, rest);
  return verify(headers, rest, pem, jwk);
}
