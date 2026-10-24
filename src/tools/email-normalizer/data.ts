// Provider-specific normalization rules. These are heuristics based on how
// each provider documents its address handling; providers can change them.

export interface ProviderRule {
  name: string;
  domains: readonly string[];
  /** Rewrite every listed domain to this one. */
  canonicalDomain?: string;
  /** The provider ignores dots in the local part. */
  ignoreDots?: boolean;
  /** Everything from this character on is a sub-address tag. */
  tagSeparator: '+' | '-';
}

export const PROVIDERS: readonly ProviderRule[] = [
  {
    name: 'Gmail',
    domains: ['gmail.com', 'googlemail.com'],
    canonicalDomain: 'gmail.com',
    ignoreDots: true,
    tagSeparator: '+',
  },
  {
    name: 'Outlook / Hotmail',
    domains: [
      'outlook.com',
      'hotmail.com',
      'live.com',
      'msn.com',
      'passport.com',
      'outlook.co.uk',
      'outlook.de',
      'outlook.fr',
      'outlook.it',
      'outlook.es',
      'hotmail.co.uk',
      'hotmail.de',
      'hotmail.fr',
      'hotmail.it',
      'hotmail.es',
      'live.co.uk',
      'live.de',
      'live.fr',
      'live.it',
      'live.nl',
      'live.ca',
    ],
    tagSeparator: '+',
  },
  {
    name: 'Yahoo',
    domains: [
      'yahoo.com',
      'ymail.com',
      'rocketmail.com',
      'yahoo.co.uk',
      'yahoo.de',
      'yahoo.fr',
      'yahoo.it',
      'yahoo.es',
      'yahoo.ca',
      'yahoo.co.jp',
      'yahoo.com.au',
      'yahoo.com.br',
      'yahoo.in',
    ],
    tagSeparator: '-',
  },
  { name: 'iCloud', domains: ['icloud.com', 'me.com', 'mac.com'], tagSeparator: '+' },
  { name: 'Proton', domains: ['proton.me', 'protonmail.com', 'protonmail.ch', 'pm.me'], tagSeparator: '+' },
  {
    name: 'Fastmail',
    domains: ['fastmail.com', 'fastmail.fm', 'fastmail.net', 'fastmail.org', 'messagingengine.com'],
    tagSeparator: '+',
  },
];

const BY_DOMAIN = new Map(PROVIDERS.flatMap((p) => p.domains.map((d) => [d, p] as const)));

export function providerFor(domain: string): ProviderRule | undefined {
  return BY_DOMAIN.get(domain);
}
