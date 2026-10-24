import { afterEach, describe, expect, it, vi } from 'vitest';
import { NETWORK_HOSTS, formatHostList, isNetworkHost } from './network-allow.ts';
import { NetworkError, networkFetch, networkJson } from './network.ts';

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('network allowlist', () => {
  it('accepts only the reviewed origins', () => {
    expect(isNetworkHost('https://cloudflare-dns.com')).toBe(true);
    expect(isNetworkHost('https://cloudflare-dns.com.evil.example')).toBe(false);
    expect(isNetworkHost('http://api.ipify.org')).toBe(false);
    expect(NETWORK_HOSTS.every((host) => new URL(host).pathname === '/')).toBe(true);
  });

  it('formats the notice list', () => {
    expect(formatHostList(['https://ipwho.is'])).toBe('ipwho.is');
    expect(formatHostList(['https://api.ipify.org', 'https://ipwho.is'])).toBe('api.ipify.org and ipwho.is');
    expect(formatHostList(['https://a.example', 'https://b.example', 'https://c.example'])).toBe(
      'a.example, b.example and c.example',
    );
  });
});

describe('networkFetch', () => {
  it('sends a credential-free GET and does not follow redirects', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ ip: '8.8.8.8' }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(networkJson('https://api.ipify.org/?format=json')).resolves.toEqual({ ip: '8.8.8.8' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(url.origin).toBe('https://api.ipify.org');
    expect(init).toMatchObject({
      method: 'GET',
      credentials: 'omit',
      redirect: 'manual',
      referrerPolicy: 'no-referrer',
      cache: 'no-store',
    });
  });

  it('refuses hosts that are not on the allowlist, before any request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(networkFetch('https://evil.example/lookup')).rejects.toBeInstanceOf(NetworkError);
    await expect(networkFetch('http://api.ipify.org/')).rejects.toBeInstanceOf(NetworkError);
    await expect(networkFetch('https://user:secret@api.ipify.org/')).rejects.toBeInstanceOf(NetworkError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('stops on a redirect and on a failed response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 302, headers: { location: 'https://evil.example' } })),
    );
    await expect(networkFetch('https://rdap.arin.net/registry/ip/1.1.1.1')).rejects.toThrow(/will not follow/);

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ error: 'no' }, 404)),
    );
    await expect(networkFetch('https://ipwho.is/8.8.8.8')).rejects.toThrow(/HTTP 404/);
  });

  it('turns a network failure into a NetworkError and leaves aborts alone', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('offline'))),
    );
    await expect(networkFetch('https://api.frankfurter.dev/v1/latest')).rejects.toBeInstanceOf(NetworkError);

    const controller = new AbortController();
    controller.abort();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new DOMException('aborted', 'AbortError'))),
    );
    await expect(networkFetch('https://cloudflare-dns.com/dns-query', { signal: controller.signal })).rejects.toThrow(
      /aborted/,
    );
  });
});
