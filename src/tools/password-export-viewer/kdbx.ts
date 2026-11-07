import { cbc, ecb } from '@noble/ciphers/aes.js';
import { chacha20 } from '@noble/ciphers/chacha.js';
import { salsa20 } from '@noble/ciphers/salsa.js';
import { hmac } from '@noble/hashes/hmac.js';
import { sha256, sha512 } from '@noble/hashes/sha2.js';
import { base64, hex } from '@scure/base';
import { argon2d, argon2id } from 'hash-wasm';
import pako from 'pako';
import { ToolInputError } from '../types.ts';

export const KDBX_SIG1 = 0x9aa2d903;
export const KDBX_SIG2 = 0xb54bfb67;

const CIPHER_AES256_CBC = '31c1f2e6bf714350be5805216afc5aff';
const CIPHER_CHACHA20 = 'd6038a2b8b6f4cb5a524339a31dbb59a';

const KDF_ARGON2D = 'ef636ddf8c29444b91f7a9a403e30a0c';
const KDF_ARGON2ID = '9e298b1956db4773b23dfc3ec6f0a1e6';
const KDF_AES = 'c9d9f39a628a4460bf740d08c18a4fea';

const SALSA20_IV = new Uint8Array([0xe8, 0x30, 0x09, 0x4b, 0x97, 0x20, 0x5d, 0x2a]);

function concatBytes(parts: readonly Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

function u32le(n: number): Uint8Array {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, n >>> 0, true);
  return out;
}

function u64le(n: bigint): Uint8Array {
  const out = new Uint8Array(8);
  new DataView(out.buffer).setBigUint64(0, BigInt.asUintN(64, n), true);
  return out;
}

export function isKdbxBytes(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return view.getUint32(0, true) === KDBX_SIG1 && view.getUint32(4, true) === KDBX_SIG2;
}

function parseKeyfileBytes(keyfile: Uint8Array): Uint8Array {
  if (keyfile.length === 32) return keyfile;
  if (keyfile.length === 64) {
    const ascii = new TextDecoder('ascii').decode(keyfile).trim();
    if (/^[0-9a-fA-F]{64}$/.test(ascii)) return hex.decode(ascii);
  }
  const text = new TextDecoder('utf-8', { fatal: false }).decode(keyfile);
  const dataMatch = /<KeyFile[\s\S]*?<Key[\s\S]*?<Data[^>]*>([\s\S]*?)<\/Data>/i.exec(text);
  if (dataMatch) {
    const raw = dataMatch[1]!.replace(/\s+/g, '');
    if (/^[0-9a-fA-F]{64}$/.test(raw)) return hex.decode(raw);
    try {
      const decoded = base64.decode(raw);
      if (decoded.length === 32) return decoded;
    } catch {
      // Fall back to hashing the file.
    }
  }
  return sha256(keyfile);
}

function computeCompositeKey(password?: string, keyfile?: Uint8Array): Uint8Array {
  const parts: Uint8Array[] = [];
  if (password !== undefined && password !== '') {
    parts.push(sha256(new TextEncoder().encode(password)));
  }
  if (keyfile && keyfile.length > 0) {
    parts.push(parseKeyfileBytes(keyfile));
  }
  if (parts.length === 0) {
    parts.push(sha256(new Uint8Array(0)));
  }
  return sha256(concatBytes(parts));
}

function parseVariantDict(bytes: Uint8Array): Record<string, number | bigint | boolean | string | Uint8Array> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 2) throw new ToolInputError('KDBX KDF parameters dictionary is truncated.');
  let p = 2; // version uint16
  const out: Record<string, number | bigint | boolean | string | Uint8Array> = {};
  while (p < bytes.length) {
    const type = bytes[p++]!;
    if (type === 0) break;
    if (p + 4 > bytes.length) throw new ToolInputError('KDBX VariantDictionary name length is truncated.');
    const nameLen = view.getInt32(p, true);
    p += 4;
    if (nameLen < 0 || p + nameLen + 4 > bytes.length) {
      throw new ToolInputError('KDBX VariantDictionary entry is truncated.');
    }
    const name = new TextDecoder().decode(bytes.subarray(p, p + nameLen));
    p += nameLen;
    const valLen = view.getInt32(p, true);
    p += 4;
    if (valLen < 0 || p + valLen > bytes.length) {
      throw new ToolInputError('KDBX VariantDictionary value is truncated.');
    }
    const valBytes = bytes.subarray(p, p + valLen);
    const valView = new DataView(valBytes.buffer, valBytes.byteOffset, valBytes.byteLength);
    p += valLen;

    if (type === 0x04 && valLen === 4) out[name] = valView.getUint32(0, true);
    else if (type === 0x05 && valLen === 8) out[name] = valView.getBigUint64(0, true);
    else if (type === 0x08 && valLen === 1) out[name] = valBytes[0] !== 0;
    else if (type === 0x0c && valLen === 4) out[name] = valView.getInt32(0, true);
    else if (type === 0x0d && valLen === 8) out[name] = valView.getBigInt64(0, true);
    else if (type === 0x18) out[name] = new TextDecoder().decode(valBytes);
    else if (type === 0x42) out[name] = new Uint8Array(valBytes);
  }
  return out;
}

function deriveAesKdf(compositeKey: Uint8Array, seed: Uint8Array, rounds: bigint): Uint8Array {
  if (seed.length !== 32) throw new ToolInputError('KDBX AES-KDF seed must be 32 bytes.');
  if (rounds < 1n || rounds > 5_000_000n) {
    throw new ToolInputError('KDBX AES-KDF rounds are out of the supported range (max 5,000,000).');
  }
  const cipher = ecb(seed, { disablePadding: true });
  let block = new Uint8Array(compositeKey);
  const count = Number(rounds);
  for (let i = 0; i < count; i++) {
    block = cipher.encrypt(block);
  }
  return sha256(block);
}

async function deriveTransformedKeyV4(compositeKey: Uint8Array, kdfDictBytes: Uint8Array): Promise<Uint8Array> {
  const dict = parseVariantDict(kdfDictBytes);
  const uuidBytes = dict.$UUID;
  if (!(uuidBytes instanceof Uint8Array)) {
    throw new ToolInputError('KDBX 4 KDF parameters are missing $UUID.');
  }
  const kdfUuid = hex.encode(uuidBytes).toLowerCase();

  if (kdfUuid === KDF_ARGON2D || kdfUuid === KDF_ARGON2ID) {
    const salt = dict.S;
    if (!(salt instanceof Uint8Array) || salt.length < 8) {
      throw new ToolInputError('KDBX 4 Argon2 salt is missing or too short.');
    }
    const parallelism = Number(dict.P ?? 1);
    const memoryBytes = Number(dict.M ?? 65536n);
    const iterations = Number(dict.I ?? 2n);
    const memorySize = Math.max(8, Math.floor(memoryBytes / 1024));
    if (memorySize > 524288 || iterations < 1 || iterations > 64 || parallelism < 1 || parallelism > 16) {
      throw new ToolInputError('KDBX 4 Argon2 parameters exceed safe browser limits.');
    }
    const fn = kdfUuid === KDF_ARGON2ID ? argon2id : argon2d;
    return await fn({
      password: compositeKey,
      salt,
      parallelism,
      iterations,
      memorySize,
      hashLength: 32,
      outputType: 'binary',
    });
  }

  if (kdfUuid === KDF_AES) {
    const seed = dict.S;
    const rounds = typeof dict.R === 'bigint' || typeof dict.R === 'number' ? BigInt(dict.R) : 6000n;
    if (!(seed instanceof Uint8Array)) throw new ToolInputError('KDBX 4 AES-KDF seed is missing.');
    return deriveAesKdf(compositeKey, seed, rounds);
  }

  throw new ToolInputError(`Unsupported KDBX 4 KDF UUID ${kdfUuid}.`);
}

function decryptPayloadCipher(
  cipherHex: string,
  masterKey: Uint8Array,
  iv: Uint8Array,
  ciphertext: Uint8Array,
): Uint8Array {
  if (cipherHex === CIPHER_AES256_CBC) {
    if (iv.length !== 16) throw new ToolInputError('KDBX AES-256-CBC IV must be 16 bytes.');
    try {
      return cbc(masterKey, iv).decrypt(ciphertext);
    } catch {
      throw new ToolInputError('Incorrect master password or keyfile (AES-CBC decryption failed).');
    }
  }
  if (cipherHex === CIPHER_CHACHA20) {
    if (iv.length !== 12) throw new ToolInputError('KDBX ChaCha20 IV must be 12 bytes.');
    return chacha20(masterKey, iv, ciphertext);
  }
  throw new ToolInputError(`Unsupported KDBX outer cipher UUID ${cipherHex}.`);
}

function createKeystreamPuller(streamId: number, streamKey: Uint8Array): (len: number) => Uint8Array {
  let buffer = new Uint8Array(0);
  let offset = 0;
  let blockCounter = 0;

  // Generate keystream in 4096-byte chunks by encrypting zeros with the appropriate stream cipher.
  if (streamId === 2) {
    const key = sha256(streamKey);
    return (len: number): Uint8Array => {
      while (buffer.length - offset < len) {
        const needed = Math.max(4096, offset + len + 1024);
        buffer = salsa20(key, SALSA20_IV, new Uint8Array(needed));
      }
      const slice = buffer.subarray(offset, offset + len);
      offset += len;
      return slice;
    };
  }

  if (streamId === 3) {
    const digest = sha512(streamKey);
    const key = digest.subarray(0, 32);
    const nonce = digest.subarray(32, 44);
    return (len: number): Uint8Array => {
      while (buffer.length - offset < len) {
        blockCounter += Math.max(4096, len + 1024);
        buffer = chacha20(key, nonce, new Uint8Array(blockCounter));
      }
      const slice = buffer.subarray(offset, offset + len);
      offset += len;
      return slice;
    };
  }

  return (len: number) => new Uint8Array(len);
}

function escapeXmlText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function unmaskProtectedXmlValues(xml: string, streamId: number, streamKey: Uint8Array): string {
  if (streamId === 0 || streamKey.length === 0) return xml;
  const pull = createKeystreamPuller(streamId, streamKey);
  return xml.replace(
    /<Value\b([^>]*)\bProtected="True"([^>]*)>([\s\S]*?)<\/Value>/gi,
    (full, pre, post, inner: string) => {
      const clean = inner.trim();
      if (clean === '') return `<Value${pre}${post}></Value>`;
      let cipherBytes: Uint8Array;
      try {
        cipherBytes = base64.decode(clean);
      } catch {
        return full;
      }
      const mask = pull(cipherBytes.length);
      const plainBytes = new Uint8Array(cipherBytes.length);
      for (let i = 0; i < cipherBytes.length; i++) {
        plainBytes[i] = cipherBytes[i]! ^ mask[i]!;
      }
      const text = new TextDecoder().decode(plainBytes);
      return `<Value${pre}${post}>${escapeXmlText(text)}</Value>`;
    },
  );
}

function readHashedBlocksV3(bytes: Uint8Array): Uint8Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let p = 0;
  const chunks: Uint8Array[] = [];
  let expectedIndex = 0;
  while (p < bytes.length) {
    if (p + 40 > bytes.length) throw new ToolInputError('KDBX 3.1 hashed block stream is truncated.');
    const idx = view.getUint32(p, true);
    if (idx !== expectedIndex++) throw new ToolInputError('KDBX 3.1 block index is out of order.');
    const hash = bytes.subarray(p + 4, p + 36);
    const size = view.getInt32(p + 36, true);
    p += 40;
    if (size === 0) break;
    if (size < 0 || p + size > bytes.length) throw new ToolInputError('KDBX 3.1 block data is truncated.');
    const data = bytes.subarray(p, p + size);
    p += size;
    if (!constantTimeEqual(sha256(data), hash)) {
      throw new ToolInputError('KDBX 3.1 payload integrity check failed.');
    }
    chunks.push(data);
  }
  return concatBytes(chunks);
}

function hmacBlockKeyV4(blockIndex: bigint, hmacKey64: Uint8Array): Uint8Array {
  return sha512(concatBytes([u64le(blockIndex), hmacKey64]));
}

function readHmacBlocksV4(bytes: Uint8Array, hmacKey64: Uint8Array): Uint8Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let p = 0;
  let blockIndex = 0n;
  const chunks: Uint8Array[] = [];
  while (p < bytes.length) {
    if (p + 36 > bytes.length) throw new ToolInputError('KDBX 4 HMAC block stream is truncated.');
    const blockHmac = bytes.subarray(p, p + 32);
    const size = view.getInt32(p + 32, true);
    p += 36;
    if (size < 0 || p + size > bytes.length) throw new ToolInputError('KDBX 4 HMAC block is truncated.');
    const data = bytes.subarray(p, p + size);
    p += size;
    const key = hmacBlockKeyV4(blockIndex, hmacKey64);
    const macInput = concatBytes([u64le(blockIndex), u32le(size), data]);
    const expected = hmac(sha256, key, macInput);
    if (!constantTimeEqual(expected, blockHmac)) {
      throw new ToolInputError('Incorrect master password or corrupted KDBX 4 payload block.');
    }
    if (size === 0) break;
    chunks.push(data);
    blockIndex++;
  }
  return concatBytes(chunks);
}

/**
 * Decrypts a KeePass KDBX 3.1 or 4.0 file into its unmasked UTF-8 `<KeePassFile>` XML string.
 */
export async function decryptKdbxToXml(
  bytes: Uint8Array,
  password?: string,
  keyfile?: Uint8Array,
): Promise<{ xml: string; version: string }> {
  if (!isKdbxBytes(bytes)) {
    throw new ToolInputError('File does not have the KeePass KDBX signature.');
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const versionRaw = view.getUint32(8, true);
  const major = versionRaw >>> 16;
  const minor = versionRaw & 0xffff;
  if (major !== 3 && major !== 4) {
    throw new ToolInputError(`Unsupported KDBX version ${major}.${minor} (only KDBX 3.x and 4.x are supported).`);
  }

  let p = 12;
  let cipherHex = CIPHER_AES256_CBC;
  let compression = 1;
  let masterSeed: Uint8Array | undefined;
  let transformSeed: Uint8Array | undefined;
  let transformRounds = 6000n;
  let encryptionIv: Uint8Array | undefined;
  let protectedStreamKey = new Uint8Array(0);
  let streamStartBytes: Uint8Array | undefined;
  let innerRandomStreamId = 0;
  let kdfParameters: Uint8Array | undefined;

  while (p < bytes.length) {
    const fieldId = bytes[p++]!;
    let fieldLen: number;
    if (major === 3) {
      if (p + 2 > bytes.length) throw new ToolInputError('KDBX 3 header is truncated.');
      fieldLen = view.getUint16(p, true);
      p += 2;
    } else {
      if (p + 4 > bytes.length) throw new ToolInputError('KDBX 4 header is truncated.');
      fieldLen = view.getInt32(p, true);
      p += 4;
    }
    if (fieldLen < 0 || p + fieldLen > bytes.length) {
      throw new ToolInputError('KDBX header field is truncated.');
    }
    const data = bytes.subarray(p, p + fieldLen);
    const dataView = new DataView(data.buffer, data.byteOffset, data.byteLength);
    p += fieldLen;

    if (fieldId === 0) break;
    if (fieldId === 2) cipherHex = hex.encode(data).toLowerCase();
    else if (fieldId === 3 && fieldLen >= 4) compression = dataView.getUint32(0, true);
    else if (fieldId === 4) masterSeed = new Uint8Array(data);
    else if (fieldId === 5) transformSeed = new Uint8Array(data);
    else if (fieldId === 6 && fieldLen >= 8) transformRounds = dataView.getBigUint64(0, true);
    else if (fieldId === 7) encryptionIv = new Uint8Array(data);
    else if (fieldId === 8) protectedStreamKey = new Uint8Array(data);
    else if (fieldId === 9) streamStartBytes = new Uint8Array(data);
    else if (fieldId === 10 && fieldLen >= 4) innerRandomStreamId = dataView.getUint32(0, true);
    else if (fieldId === 11) kdfParameters = new Uint8Array(data);
  }

  const headerEndOffset = p;
  if (!masterSeed || masterSeed.length !== 32 || !encryptionIv) {
    throw new ToolInputError('KDBX header is missing MasterSeed or EncryptionIV.');
  }

  const compositeKey = computeCompositeKey(password, keyfile);

  if (major === 3) {
    if (!transformSeed || !streamStartBytes) {
      throw new ToolInputError('KDBX 3.1 header is missing TransformSeed or StreamStartBytes.');
    }
    const transformedKey = deriveAesKdf(compositeKey, transformSeed, transformRounds);
    const masterKey = sha256(concatBytes([masterSeed, transformedKey]));
    const decrypted = decryptPayloadCipher(cipherHex, masterKey, encryptionIv, bytes.subarray(headerEndOffset));
    if (decrypted.length < 32 || !constantTimeEqual(decrypted.subarray(0, 32), streamStartBytes)) {
      throw new ToolInputError('Incorrect master password or keyfile for this KDBX 3.1 database.');
    }
    const blockBytes = readHashedBlocksV3(decrypted.subarray(32));
    const xmlBytes = compression === 1 ? pako.inflate(blockBytes) : blockBytes;
    const rawXml = new TextDecoder().decode(xmlBytes);
    const xml = unmaskProtectedXmlValues(rawXml, innerRandomStreamId, protectedStreamKey);
    return { xml, version: `3.${minor}` };
  }

  // KDBX 4.x
  if (!kdfParameters) throw new ToolInputError('KDBX 4 header is missing KdfParameters.');
  if (headerEndOffset + 64 > bytes.length) {
    throw new ToolInputError('KDBX 4 header integrity hashes are truncated.');
  }
  const headerBytes = bytes.subarray(0, headerEndOffset);
  const expectedHeaderSha = bytes.subarray(headerEndOffset, headerEndOffset + 32);
  const expectedHeaderHmac = bytes.subarray(headerEndOffset + 32, headerEndOffset + 64);
  if (!constantTimeEqual(sha256(headerBytes), expectedHeaderSha)) {
    throw new ToolInputError('KDBX 4 header SHA-256 checksum failed.');
  }

  const transformedKey = await deriveTransformedKeyV4(compositeKey, kdfParameters);
  const masterKey = sha256(concatBytes([masterSeed, transformedKey]));
  const hmacKey64 = sha512(concatBytes([masterSeed, transformedKey, new Uint8Array([1])]));
  const headerHmacKey = hmacBlockKeyV4(0xffffffffffffffffn, hmacKey64);
  const computedHeaderHmac = hmac(sha256, headerHmacKey, headerBytes);
  if (!constantTimeEqual(computedHeaderHmac, expectedHeaderHmac)) {
    throw new ToolInputError('Incorrect master password or keyfile for this KDBX 4 database.');
  }

  const encryptedPayload = readHmacBlocksV4(bytes.subarray(headerEndOffset + 64), hmacKey64);
  const decryptedPayload = decryptPayloadCipher(cipherHex, masterKey, encryptionIv, encryptedPayload);
  const innerBytes = compression === 1 ? pako.inflate(decryptedPayload) : decryptedPayload;

  // Parse KDBX 4 inner header
  const innerView = new DataView(innerBytes.buffer, innerBytes.byteOffset, innerBytes.byteLength);
  let ip = 0;
  while (ip < innerBytes.length) {
    const id = innerBytes[ip++]!;
    if (ip + 4 > innerBytes.length) throw new ToolInputError('KDBX 4 inner header is truncated.');
    const len = innerView.getInt32(ip, true);
    ip += 4;
    if (len < 0 || ip + len > innerBytes.length) throw new ToolInputError('KDBX 4 inner header field is truncated.');
    const val = innerBytes.subarray(ip, ip + len);
    const valView = new DataView(val.buffer, val.byteOffset, val.byteLength);
    ip += len;
    if (id === 0) break;
    if (id === 1 && len >= 4) innerRandomStreamId = valView.getUint32(0, true);
    else if (id === 2) protectedStreamKey = new Uint8Array(val);
  }

  const rawXml = new TextDecoder().decode(innerBytes.subarray(ip));
  const xml = unmaskProtectedXmlValues(rawXml, innerRandomStreamId, protectedStreamKey);
  return { xml, version: `4.${minor}` };
}

function encodeVariantEntry(type: number, name: string, valBytes: Uint8Array): Uint8Array {
  const nameBytes = new TextEncoder().encode(name);
  return concatBytes([new Uint8Array([type]), u32le(nameBytes.length), nameBytes, u32le(valBytes.length), valBytes]);
}

function headerFieldV4(id: number, data: Uint8Array): Uint8Array {
  return concatBytes([new Uint8Array([id]), u32le(data.length), data]);
}

/**
 * Builds a genuine KDBX 4.0 file encrypted with Argon2d + AES-256-CBC + Gzip + ChaCha20 inner stream
 * so users and unit tests can test real KDBX 4 decryption locally.
 */
export async function buildSampleKdbx4(password = 'correct-horse'): Promise<Uint8Array> {
  const masterSeed = new Uint8Array(32).fill(0x11);
  const kdfSalt = new Uint8Array(32).fill(0x22);
  const encryptionIv = new Uint8Array(16).fill(0x33);
  const streamKey = new Uint8Array(32).fill(0x44);

  const kdfDict = concatBytes([
    new Uint8Array([0x00, 0x01]),
    encodeVariantEntry(0x42, '$UUID', hex.decode(KDF_ARGON2D)),
    encodeVariantEntry(0x42, 'S', kdfSalt),
    encodeVariantEntry(0x04, 'P', u32le(1)),
    encodeVariantEntry(0x05, 'M', u64le(64n * 1024n)),
    encodeVariantEntry(0x05, 'I', u64le(2n)),
    encodeVariantEntry(0x04, 'V', u32le(0x13)),
    new Uint8Array([0x00]),
  ]);

  const headerBytes = concatBytes([
    u32le(KDBX_SIG1),
    u32le(KDBX_SIG2),
    u32le(0x00040000),
    headerFieldV4(2, hex.decode(CIPHER_AES256_CBC)),
    headerFieldV4(3, u32le(1)), // gzip
    headerFieldV4(4, masterSeed),
    headerFieldV4(7, encryptionIv),
    headerFieldV4(11, kdfDict),
    headerFieldV4(0, new Uint8Array([0x0d, 0x0a, 0x0d, 0x0a])),
  ]);

  // Mask two sample passwords with the ChaCha20 inner stream (id = 3)
  const pull = createKeystreamPuller(3, streamKey);
  const maskString = (plain: string) => {
    const raw = new TextEncoder().encode(plain);
    const mask = pull(raw.length);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw[i]! ^ mask[i]!;
    return base64.encode(out);
  };

  const maskedPw1 = maskString('hunter2-kdbx-secret');
  const maskedOtp1 = maskString('otpauth://totp/GitHub:alice?secret=JBSWY3DPEHPK3PXP&issuer=GitHub');

  const xml = `<?xml version="1.0" encoding="utf-8" standalone="yes"?>
<KeePassFile>
  <Root>
    <Group>
      <Name>Work Vault</Name>
      <Entry>
        <String><Key>Title</Key><Value>GitHub Production</Value></String>
        <String><Key>UserName</Key><Value>alice@example.com</Value></String>
        <String><Key>Password</Key><Value Protected="True">${maskedPw1}</Value></String>
        <String><Key>URL</Key><Value>https://example.com/login</Value></String>
        <String><Key>Notes</Key><Value>Primary engineering account</Value></String>
        <String><Key>otp</Key><Value Protected="True">${maskedOtp1}</Value></String>
      </Entry>
    </Group>
  </Root>
</KeePassFile>`;

  const innerPayload = concatBytes([
    headerFieldV4(1, u32le(3)), // ChaCha20 inner stream
    headerFieldV4(2, streamKey),
    headerFieldV4(0, new Uint8Array(0)),
    new TextEncoder().encode(xml),
  ]);

  const compressed = pako.gzip(innerPayload);
  const compositeKey = computeCompositeKey(password);
  const transformedKey = await deriveTransformedKeyV4(compositeKey, kdfDict);
  const masterKey = sha256(concatBytes([masterSeed, transformedKey]));
  const ciphertext = cbc(masterKey, encryptionIv).encrypt(compressed);

  const hmacKey64 = sha512(concatBytes([masterSeed, transformedKey, new Uint8Array([1])]));
  const headerSha = sha256(headerBytes);
  const headerHmac = hmac(sha256, hmacBlockKeyV4(0xffffffffffffffffn, hmacKey64), headerBytes);

  const block0Key = hmacBlockKeyV4(0n, hmacKey64);
  const block0Mac = hmac(sha256, block0Key, concatBytes([u64le(0n), u32le(ciphertext.length), ciphertext]));
  const block1Key = hmacBlockKeyV4(1n, hmacKey64);
  const block1Mac = hmac(sha256, block1Key, concatBytes([u64le(1n), u32le(0)]));

  return concatBytes([
    headerBytes,
    headerSha,
    headerHmac,
    block0Mac,
    u32le(ciphertext.length),
    ciphertext,
    block1Mac,
    u32le(0),
  ]);
}
