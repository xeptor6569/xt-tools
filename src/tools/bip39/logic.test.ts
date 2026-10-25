import { bytesToHex } from '@noble/hashes/utils.js';
import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { bip39, mnemonicFromEntropy } from './logic.ts';

const ABANDON = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const TREZOR_SEED =
  'c55257c360c07c72029aebc1b53c05ed0362ada38ead3e3e9efa3708e53495531f09a6987599d18264c1e1c92f2cf141630c7a3c4ab7c81b2f001698e7463b04';

describe('bip39', () => {
  it('turns the all-zero entropy vector into the official mnemonic', () => {
    expect(mnemonicFromEntropy(new Uint8Array(16))).toBe(ABANDON);
    expect(bip39('mode: mnemonic\nentropy-hex: 00000000000000000000000000000000')).toContain(ABANDON);
  });

  it('derives the official TREZOR seed for the abandon mnemonic', () => {
    const out = bip39(`passphrase: TREZOR\n${ABANDON}`);
    expect(out).toContain(`seed: ${TREZOR_SEED}`);
    const empty = bip39(ABANDON);
    expect(empty).toContain('seed: ');
    expect(empty).not.toContain(TREZOR_SEED);
    expect(bytesToHex(new Uint8Array([0]))).toBe('00');
  });

  it('rejects a checksum failure', () => {
    expect(() =>
      bip39('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon'),
    ).toThrow(ToolInputError);
  });

  it('returns nothing for an empty box', () => {
    expect(bip39('')).toBe('');
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(bip39);
  });
});
