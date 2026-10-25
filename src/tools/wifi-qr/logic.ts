import { ToolInputError } from '../types.ts';

const MAX_INPUT = 10_000;
const MAX_SSID_BYTES = 32;
const MAX_PASSWORD = 63;

type Auth = 'WPA' | 'WEP' | 'nopass';

/**
 * Wi-Fi QR payload, `WIFI:T:WPA;S:ssid;P:password;;`.
 *
 * One line is `SSID password` (WPA). Put `WPA`, `WEP` or `nopass` first when
 * it is not WPA. When the network name contains spaces, use
 * `AUTH|SSID|password` or `SSID|password`.
 */
export function wifiQr(input: string): string {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large.');
  const text = input.trim();
  if (text === '') return '';
  const fields = parseWifi(text);
  if (!fields) return '';
  const { auth, ssid, password } = fields;
  if (ssid === '') throw new ToolInputError('Enter the network name.');
  if (utf8Size(ssid) > MAX_SSID_BYTES) {
    throw new ToolInputError(`Network names can be at most ${MAX_SSID_BYTES} bytes.`);
  }
  if (auth === 'nopass') {
    if (password !== '') throw new ToolInputError('An open network has no password. Leave it blank.');
    return `WIFI:T:nopass;S:${escapeWifi(ssid)};;`;
  }
  if (password === '') throw new ToolInputError(`${auth} needs a password.`);
  if (password.length > MAX_PASSWORD) {
    throw new ToolInputError(`Passwords can be at most ${MAX_PASSWORD} characters.`);
  }
  return `WIFI:T:${auth};S:${escapeWifi(ssid)};P:${escapeWifi(password)};;`;
}

/** Escapes `\ ; , : "` the way Wi-Fi QR payloads require. */
export function escapeWifi(value: string): string {
  return value.replace(/[\\;,:"']/g, (ch) => `\\${ch}`);
}

function parseWifi(text: string): { auth: Auth; ssid: string; password: string } | undefined {
  if (text.includes('|')) {
    const parts = text.split('|');
    if (parts.length === 2) {
      const ssid = parts[0]?.trim() ?? '';
      const password = parts[1]?.trim() ?? '';
      return { auth: password === '' ? 'nopass' : 'WPA', ssid, password };
    }
    if (parts.length === 3) {
      return {
        auth: normalizeAuth(parts[0]?.trim() ?? ''),
        ssid: parts[1]?.trim() ?? '',
        password: parts[2]?.trim() ?? '',
      };
    }
    throw new ToolInputError('Use SSID|password or AUTH|SSID|password.');
  }

  const tokens = text.split(/\s+/).filter(Boolean);
  const first = tokens[0] ?? '';
  let auth: Auth = 'WPA';
  let explicit = false;
  let rest = tokens;
  if (isAuth(first)) {
    auth = normalizeAuth(first);
    explicit = true;
    rest = tokens.slice(1);
  }
  const ssid = rest[0] ?? '';
  const password = rest.slice(1).join(' ');
  if (ssid === '') throw new ToolInputError('Enter the network name.');
  if (!explicit && password === '') return { auth: 'nopass', ssid, password: '' };
  return { auth, ssid, password };
}

function isAuth(token: string): boolean {
  return /^(?:wpa2?|wpa3|wpa2\/wpa3|wep|nopass|open|none)$/i.test(token);
}

function normalizeAuth(token: string): Auth {
  const value = token.toLowerCase();
  if (value === 'wpa' || value === 'wpa2' || value === 'wpa3' || value === 'wpa2/wpa3') return 'WPA';
  if (value === 'wep') return 'WEP';
  if (value === 'nopass' || value === 'open' || value === 'none') return 'nopass';
  throw new ToolInputError('Auth must be WPA, WEP or nopass.');
}

function utf8Size(value: string): number {
  return new TextEncoder().encode(value).length;
}
