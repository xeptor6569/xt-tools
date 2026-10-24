const UNITS = ['B', 'KB', 'MB', 'GB'] as const;

/** Short size for the settings storage estimate. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const current = UNITS[unit] ?? 'B';
  const shown = unit === 0 || value >= 10 ? value.toFixed(0) : value.toFixed(1);
  return `${shown} ${current}`;
}

export function formatEstimate(usage: number | undefined, quota: number | undefined): string {
  if (usage == null) return '';
  if (quota == null) return `Using ${formatBytes(usage)}.`;
  return `Using ${formatBytes(usage)} of ${formatBytes(quota)}.`;
}
