import { ToolInputError } from '../types.ts';
import { pemEncode } from '../x509-decoder/der.ts';

/** Reads the bit-size field. A blank field means 2048. Only 2048 and 4096 are allowed. */
export function parseBits(text: string): 2048 | 4096 {
  const trimmed = text.trim();
  if (trimmed === '' || trimmed === '2048') return 2048;
  if (trimmed === '4096') return 4096;
  throw new ToolInputError('Enter 2048 or 4096.');
}

/** Generates an RSA key pair with WebCrypto and exports SPKI plus PKCS#8 PEM. */
export async function generateRsa(bits: number): Promise<string> {
  if (bits !== 2048 && bits !== 4096) throw new ToolInputError('Enter 2048 or 4096.');
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new ToolInputError('RSA generation needs WebCrypto.');
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
  return `${pemEncode('PUBLIC KEY', spki)}\n${pemEncode('PRIVATE KEY', pkcs8)}\n`;
}
