// localStorage for recently opened tools. Other parts of the page hear changes
// through `xt-recents`. This module does not load the tool catalog.

import { readJson, writeJson } from './storage.ts';
import { RECENTS_KEY, rememberRecent, sanitizeRecents } from './recents.ts';

export const RECENTS_EVENT = 'xt-recents';

export function loadRecents(known?: ReadonlySet<string>): string[] {
  return sanitizeRecents(readJson(RECENTS_KEY), known);
}

export function recordStoredRecent(id: string): void {
  writeJson(RECENTS_KEY, { ids: rememberRecent(loadRecents(), id) });
  window.dispatchEvent(new CustomEvent(RECENTS_EVENT));
}
