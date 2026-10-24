// The only sanctioned way to contact another origin. The caller passes a URL
// whose origin is on the allowlist. Requests are GET, carry no cookies, and
// stop if the service redirects somewhere else.
import { isNetworkHost } from './network-allow.ts';

export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

export interface NetworkRequest {
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

export async function networkFetch(url: string | URL, init: NetworkRequest = {}): Promise<Response> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new NetworkError('The lookup URL is not valid.');
  }
  if (parsed.username !== '' || parsed.password !== '') {
    throw new NetworkError('Lookup URLs cannot contain a username or password.');
  }
  if (parsed.protocol !== 'https:') throw new NetworkError('Lookups only use HTTPS.');
  if (!isNetworkHost(parsed.origin)) throw new NetworkError(`Refusing to contact ${parsed.origin}.`);
  parsed.hash = '';

  let response: Response;
  try {
    response = await fetch(parsed, {
      method: 'GET',
      credentials: 'omit',
      redirect: 'manual',
      referrerPolicy: 'no-referrer',
      cache: 'no-store',
      signal: init.signal,
      headers: init.headers,
    });
  } catch (error) {
    if (init.signal?.aborted) throw error;
    throw new NetworkError('The lookup could not reach the service. Check your connection and try again.');
  }

  if (response.type === 'opaqueredirect' || (response.status >= 300 && response.status < 400)) {
    throw new NetworkError('The service redirected to another host, and this tool will not follow it.');
  }
  if (!response.ok) throw new NetworkError(`The lookup failed (HTTP ${response.status}).`);
  return response;
}

export async function networkJson(url: string | URL, init?: NetworkRequest): Promise<unknown> {
  const response = await networkFetch(url, init);
  try {
    return await response.json();
  } catch {
    throw new NetworkError('The service returned a response that is not JSON.');
  }
}
