import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import { entropyToMnemonic, mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { ToolInputError } from '../types.ts';

const MAX_INPUT = 10_000;

function headersAndBody(input: string): { headers: Record<string, string>; body: string } {
  const known = new Set(['mode', 'passphrase', 'entropy-hex', 'words']);
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

/** 16, 20, 24, 28 or 32 entropy bytes become a 12–24 word English mnemonic. */
export function mnemonicFromEntropy(entropy: Uint8Array): string {
  try {
    return entropyToMnemonic(entropy, wordlist);
  } catch {
    throw new ToolInputError('Entropy must be 16, 20, 24, 28 or 32 bytes.');
  }
}

function format(mnemonic: string, passphrase: string): string {
  let seed: Uint8Array;
  try {
    seed = mnemonicToSeedSync(mnemonic, passphrase);
  } catch {
    throw new ToolInputError('That mnemonic could not be turned into a seed.');
  }
  const lines = [`mnemonic: ${mnemonic}`, `seed: ${bytesToHex(seed)}`];
  if (passphrase) lines.push('passphrase: set');
  return lines.join('\n');
}

/**
 * Recovers a BIP39 seed, or builds a mnemonic from entropy-hex / `entropy` bytes.
 * Passphrase is the optional BIP39 passphrase (not the 25th word list itself).
 */
export function bip39(input: string, entropy?: Uint8Array): string {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large.');
  if (input.trim() === '') return '';
  const { headers, body } = headersAndBody(input);
  const passphrase = headers.passphrase ?? '';
  const wantsMnemonic =
    (headers.mode ?? '').trim().toLowerCase() === 'mnemonic' || headers['entropy-hex'] !== undefined;
  if (wantsMnemonic) {
    let bytes = entropy;
    if (headers['entropy-hex'] !== undefined && headers['entropy-hex'].trim() !== '') {
      const hex = headers['entropy-hex'].trim().replace(/\s+/g, '');
      if (hex.length % 2 !== 0 || /[^0-9a-f]/i.test(hex)) throw new ToolInputError('entropy-hex must be hex.');
      bytes = hexToBytes(hex);
    }
    if (!bytes) throw new ToolInputError('Entropy is missing.');
    return format(mnemonicFromEntropy(bytes), passphrase);
  }
  const mnemonic = (body.trim() || input.trim()).replace(/\s+/g, ' ');
  if (!validateMnemonic(mnemonic, wordlist)) throw new ToolInputError('That is not a valid BIP39 English mnemonic.');
  return format(mnemonic, passphrase);
}
