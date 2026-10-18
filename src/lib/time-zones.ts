// Time zone helpers built on Intl, so no time zone database ships with the site.

export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** IANA time zone names known to this browser, with UTC first. */
export function timeZoneOptions(): Array<{ value: string; label: string }> {
  let zones: string[];
  try {
    zones =
      (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.('timeZone') ?? [];
  } catch {
    zones = [];
  }
  const list = ['UTC', ...zones.filter((z) => z !== 'UTC')];
  return list.map((z) => ({ value: z, label: z.replace(/_/g, ' ') }));
}
