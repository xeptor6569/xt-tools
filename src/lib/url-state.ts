// Shareable tool state in the URL fragment (#s=...). Fragments are never sent
// to servers, so they don't end up in access logs. State is only written when
// the user asks for a share link. Never use this in sensitive tools.

const PARAM = 's';
const MAX_ENCODED = 8000;

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([new Uint8Array(bytes)]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

export async function encodeState(state: unknown): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(state));
  const compressed = await pipe(json, new CompressionStream('deflate-raw'));
  const encoded = toBase64Url(compressed);
  if (encoded.length > MAX_ENCODED) throw new Error('This input is too large to share as a link.');
  return encoded;
}

export async function decodeState<T>(encoded: string): Promise<T | undefined> {
  try {
    const json = await pipe(fromBase64Url(encoded), new DecompressionStream('deflate-raw'));
    return JSON.parse(new TextDecoder().decode(json)) as T;
  } catch {
    return undefined;
  }
}

/** Reads shared state from the current URL fragment, if any. */
export async function readSharedState<T>(hash = globalThis.location?.hash ?? ''): Promise<T | undefined> {
  const value = new URLSearchParams(hash.replace(/^#/, '')).get(PARAM);
  return value ? decodeState<T>(value) : undefined;
}

export async function shareUrl(state: unknown, base = globalThis.location?.href ?? ''): Promise<string> {
  const url = new URL(base);
  url.hash = `${PARAM}=${await encodeState(state)}`;
  return url.href;
}
