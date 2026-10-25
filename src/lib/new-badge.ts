// The "New" badge is decided at build time so it does not depend on the visitor's clock.

/** How long a tool shows the "New" badge. */
export const NEW_FOR_DAYS = 30;

const DAY_MS = 24 * 3600 * 1000;

/** `YYYY-MM-DD` of the build, injected by Vite. */
export function buildDate(): string {
  return __XT_BUILD_DATE__;
}

/** True when `added` is on the build date or within the previous {@link NEW_FOR_DAYS} days. */
export function isNew(tool: { added: string }, today = buildDate()): boolean {
  const added = Date.parse(tool.added);
  const now = Date.parse(today);
  if (Number.isNaN(added) || Number.isNaN(now)) return false;
  const age = now - added;
  return age >= 0 && age <= NEW_FOR_DAYS * DAY_MS;
}
