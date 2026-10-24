// Origins a tool may contact. CSP connect-src, scan-dist and networkFetch
// all read this list, so adding a host is a reviewed change, not a string
// in a tool.
export const NETWORK_HOSTS = [
  'https://api.ipify.org',
  'https://api64.ipify.org',
  'https://ipwho.is',
  'https://cloudflare-dns.com',
  'https://api.frankfurter.dev',
  'https://rdap.verisign.com',
  'https://rdap.publicinterestregistry.org',
  'https://rdap.arin.net',
] as const;

export type NetworkHost = (typeof NETWORK_HOSTS)[number];

const HOSTS: ReadonlySet<string> = new Set(NETWORK_HOSTS);

export function isNetworkHost(origin: string): origin is NetworkHost {
  return HOSTS.has(origin);
}

/** "a, b and c" for the notice on a network tool. */
export function formatHostList(origins: readonly string[]): string {
  const hosts = origins.map((origin) => new URL(origin).host);
  if (hosts.length <= 1) return hosts[0] ?? '';
  if (hosts.length === 2) return `${hosts[0]} and ${hosts[1]}`;
  return `${hosts.slice(0, -1).join(', ')} and ${hosts.at(-1)}`;
}
