import { x25519 } from '@noble/curves/ed25519.js';
import { ToolInputError } from '../types.ts';

const KEY_BYTES = 32;

export interface WireguardKeys {
  privateKey: string;
  publicKey: string;
  config: string;
}

/** X25519 key pair and a starter WireGuard config. `secret` is 32 random bytes. */
export function wireguard(secret: Uint8Array, endpoint = ''): WireguardKeys {
  if (!(secret instanceof Uint8Array) || secret.length !== KEY_BYTES) {
    throw new ToolInputError('A WireGuard private key is 32 bytes.');
  }
  const peer = checkEndpoint(endpoint);
  const privateKeyBytes = clamp(secret);
  const publicKeyBytes = x25519.getPublicKey(privateKeyBytes);
  const privateKey = base64(privateKeyBytes);
  const publicKey = base64(publicKeyBytes);
  const lines = [
    '[Interface]',
    `PrivateKey = ${privateKey}`,
    `# PublicKey = ${publicKey}`,
    '# Address = 10.0.0.2/32',
    '',
    '[Peer]',
    '# PublicKey = <peer public key>',
    '# AllowedIPs = 0.0.0.0/0, ::/0',
    peer === '' ? '# Endpoint = vpn.example.com:51820' : `Endpoint = ${peer}`,
    '# PersistentKeepalive = 25',
  ];
  return { privateKey, publicKey, config: lines.join('\n') };
}

/** Text shown in the tool: the two keys, then the config. */
export function formatWireguard(keys: WireguardKeys): string {
  return `Private key: ${keys.privateKey}\nPublic key: ${keys.publicKey}\n\n${keys.config}`;
}

function clamp(secret: Uint8Array): Uint8Array {
  const bytes = new Uint8Array(secret);
  bytes[0] = (bytes[0] ?? 0) & 248;
  bytes[31] = ((bytes[31] ?? 0) & 127) | 64;
  return bytes;
}

function base64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function checkEndpoint(endpoint: string): string {
  const value = endpoint.trim();
  if (value === '') return '';
  if (value.length > 255) throw new ToolInputError('Endpoint is too long.');
  const host = /^[a-z0-9.-]+(?::\d{1,5})?$/i;
  const ipv4 = /^\d{1,3}(?:\.\d{1,3}){3}(?::\d{1,5})?$/;
  const ipv6 = /^\[[0-9a-f:]+\](?::\d{1,5})?$/i;
  if (!host.test(value) && !ipv4.test(value) && !ipv6.test(value)) {
    throw new ToolInputError('Enter an endpoint like vpn.example.com:51820.');
  }
  const port = portOf(value);
  if (port !== undefined && (port < 1 || port > 65535)) {
    throw new ToolInputError('The endpoint port must be between 1 and 65535.');
  }
  return value;
}

function portOf(value: string): number | undefined {
  const bracket = value.match(/\]:(\d+)$/);
  if (bracket) return Number(bracket[1]);
  if (value.startsWith('[')) return undefined;
  const parts = value.split(':');
  if (parts.length === 2) return Number(parts[1]);
  return undefined;
}
