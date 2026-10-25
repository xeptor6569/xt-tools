import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { ToolInputError } from '../types.ts';
import { formatWireguard, wireguard } from './logic.ts';

const RFC_SECRET = hex('77076d0a7318a57d3c16c17251b26645df4c2f87ebc0992ab177fba51db92c2a');
const PUBLIC_HEX = '8520f0098930a754748b7ddcb43ef75a0dbf3a0d26381af4eba4a98eaa9b4e6a';
const CLAMPED_HEX = '70076d0a7318a57d3c16c17251b26645df4c2f87ebc0992ab177fba51db92c6a';

function hex(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = Number.parseInt(text.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function fromBase64(text: string): Uint8Array {
  const binary = atob(text);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

describe('wireguard', () => {
  it('derives the RFC 7748 X25519 public key and clamps the private key', () => {
    const keys = wireguard(RFC_SECRET);
    expect(toHex(fromBase64(keys.publicKey))).toBe(PUBLIC_HEX);
    expect(toHex(fromBase64(keys.privateKey))).toBe(CLAMPED_HEX);
    expect(keys.config).toContain('[Interface]');
    expect(keys.config).toContain(`PrivateKey = ${keys.privateKey}`);
    expect(keys.config).toContain(`# PublicKey = ${keys.publicKey}`);
    expect(keys.config).toContain('# Endpoint = vpn.example.com:51820');
  });

  it('keeps the same keys when only the endpoint changes', () => {
    const plain = wireguard(RFC_SECRET, '');
    const peered = wireguard(RFC_SECRET, 'vpn.example.com:51820');
    expect(peered.privateKey).toBe(plain.privateKey);
    expect(peered.publicKey).toBe(plain.publicKey);
    expect(peered.config).toContain('Endpoint = vpn.example.com:51820');
    expect(formatWireguard(peered)).toContain('Private key:');
    expect(formatWireguard(peered)).toContain('[Interface]');
  });

  it('accepts an IPv6 endpoint and rejects a bad one', () => {
    expect(wireguard(RFC_SECRET, '[2001:db8::1]:51820').config).toContain('Endpoint = [2001:db8::1]:51820');
    expect(() => wireguard(new Uint8Array(16))).toThrow(ToolInputError);
    expect(() => wireguard(RFC_SECRET, '<script>')).toThrow(ToolInputError);
    expect(() => wireguard(RFC_SECRET, 'vpn.example.com:99999')).toThrow(ToolInputError);
  });

  it('survives empty, huge and malformed endpoints', () => {
    expectRobust((input) => formatWireguard(wireguard(RFC_SECRET, input)));
  });
});
