// localStorage for pins (`favorites`) and personal collections. Other tabs and
// the open page hear changes through `xt-library`.

import {
  COLLECTIONS_KEY,
  deleteCollection,
  PINS_KEY,
  prunePins,
  sanitizeCollections,
  sanitizePins,
  togglePinList,
  type LibraryCatalog,
  type PersonalCollection,
  type Pin,
} from './library.ts';
import { readJson, writeJson } from './storage.ts';

export const LIBRARY_EVENT = 'xt-library';

function notify(): void {
  window.dispatchEvent(new CustomEvent(LIBRARY_EVENT));
}

export function loadPins(): Pin[] {
  return sanitizePins(readJson(PINS_KEY));
}

export function savePins(pins: Pin[]): void {
  writeJson(PINS_KEY, { pins });
  notify();
}

export function toggleStoredPin(pin: Pin): 'added' | 'removed' | 'full' {
  const result = togglePinList(loadPins(), pin);
  if (result.full) return 'full';
  savePins(result.pins);
  return result.added ? 'added' : 'removed';
}

/** Drops pins whose target no longer exists and writes them back when that changes the list. */
export function pruneStoredPins(catalog: LibraryCatalog, collectionIds: readonly string[]): Pin[] {
  const pins = loadPins();
  const pruned = prunePins(pins, catalog, collectionIds);
  if (pruned.length !== pins.length) savePins(pruned);
  return pruned;
}

export function loadCollections(): PersonalCollection[] {
  return sanitizeCollections(readJson(COLLECTIONS_KEY));
}

export function saveCollections(collections: PersonalCollection[]): void {
  writeJson(COLLECTIONS_KEY, { collections });
  notify();
}

export function deleteStoredCollection(id: string): string[] {
  const { collections, removedIds } = deleteCollection(loadCollections(), id);
  const pins = loadPins().filter((pin) => pin.kind !== 'collection' || !removedIds.includes(pin.id));
  writeJson(COLLECTIONS_KEY, { collections });
  writeJson(PINS_KEY, { pins });
  notify();
  return removedIds;
}
