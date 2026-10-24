// Pins and personal collections. Pure data only: storage lives in library-store.ts.
// Pins cover tools, curated groups (`category/group`), categories and personal collections.

export const PINS_KEY = 'favorites';
export const COLLECTIONS_KEY = 'collections';
export const MAX_PINS = 48;
export const MAX_COLLECTIONS = 40;
export const MAX_NAME = 40;
export const MAX_TOOLS = 100;

export const PIN_KINDS = ['tool', 'category', 'group', 'collection'] as const;
export type PinKind = (typeof PIN_KINDS)[number];

export interface Pin {
  kind: PinKind;
  id: string;
}

export interface PersonalCollection {
  id: string;
  name: string;
  /** A top-level collection, or null. Sub-collections cannot themselves contain collections. */
  parentId: string | null;
  toolIds: string[];
}

export interface LibraryCatalog {
  toolIds: readonly string[];
  categoryIds: readonly string[];
  /** `${categoryId}/${groupId}` for every curated group. */
  groupIds: readonly string[];
}

const COLLECTION_ID = /^[a-f0-9]{16}$/;

export function pinAttr(pin: Pin): string {
  return `${pin.kind}:${pin.id}`;
}

export function samePin(a: Pin, b: Pin): boolean {
  return a.kind === b.kind && a.id === b.id;
}

export function parsePinAttr(value: string | undefined): Pin | undefined {
  if (!value) return undefined;
  const split = value.indexOf(':');
  if (split <= 0) return undefined;
  const kind = value.slice(0, split);
  const id = value.slice(split + 1);
  if (!PIN_KINDS.includes(kind as PinKind)) return undefined;
  if (id.length === 0 || id.length > 80) return undefined;
  return { kind: kind as PinKind, id };
}

export function sanitizePins(value: unknown): Pin[] {
  const raw = value && typeof value === 'object' && 'pins' in value ? (value as { pins: unknown }).pins : value;
  if (!Array.isArray(raw)) return [];
  const pins: Pin[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const kind = (item as { kind?: unknown }).kind;
    const id = (item as { id?: unknown }).id;
    if (typeof kind !== 'string' || typeof id !== 'string') continue;
    const pin = parsePinAttr(`${kind}:${id}`);
    if (!pin || seen.has(pinAttr(pin))) continue;
    seen.add(pinAttr(pin));
    pins.push(pin);
    if (pins.length >= MAX_PINS) break;
  }
  return pins;
}

export function togglePinList(pins: Pin[], pin: Pin): { pins: Pin[]; added: boolean; full: boolean } {
  if (pins.some((item) => samePin(item, pin))) {
    return { pins: pins.filter((item) => !samePin(item, pin)), added: false, full: false };
  }
  if (pins.length >= MAX_PINS) return { pins, added: false, full: true };
  return { pins: [pin, ...pins], added: true, full: false };
}

export function isKnownPin(pin: Pin, catalog: LibraryCatalog, collectionIds: readonly string[]): boolean {
  if (pin.kind === 'tool') return catalog.toolIds.includes(pin.id);
  if (pin.kind === 'category') return catalog.categoryIds.includes(pin.id);
  if (pin.kind === 'group') return catalog.groupIds.includes(pin.id);
  return collectionIds.includes(pin.id);
}

export function prunePins(pins: Pin[], catalog: LibraryCatalog, collectionIds: readonly string[]): Pin[] {
  return pins.filter((pin) => isKnownPin(pin, catalog, collectionIds));
}

export function newCollectionId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function cleanName(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const name = value.replace(/[\r\n\t]+/g, ' ').trim();
  if (name.length === 0 || name.length > MAX_NAME) return undefined;
  return name;
}

function cleanToolIds(value: unknown, known?: ReadonlySet<string>): string[] {
  if (!Array.isArray(value)) return [];
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== 'string' || item.length === 0 || item.length > 40 || seen.has(item)) continue;
    if (known && !known.has(item)) continue;
    seen.add(item);
    ids.push(item);
    if (ids.length >= MAX_TOOLS) break;
  }
  return ids;
}

export function sanitizeCollections(value: unknown, knownTools?: ReadonlySet<string>): PersonalCollection[] {
  const raw =
    value && typeof value === 'object' && 'collections' in value
      ? (value as { collections: unknown }).collections
      : value;
  if (!Array.isArray(raw)) return [];

  const parents: PersonalCollection[] = [];
  const children: PersonalCollection[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const record = item as { id?: unknown; name?: unknown; parentId?: unknown; toolIds?: unknown };
    if (typeof record.id !== 'string' || !COLLECTION_ID.test(record.id) || seen.has(record.id)) continue;
    const name = cleanName(record.name);
    if (!name) continue;
    const parentId = record.parentId === null || record.parentId === undefined ? null : record.parentId;
    if (parentId !== null && (typeof parentId !== 'string' || !COLLECTION_ID.test(parentId))) continue;
    seen.add(record.id);
    const collection: PersonalCollection = {
      id: record.id,
      name,
      parentId,
      toolIds: cleanToolIds(record.toolIds, knownTools),
    };
    if (parentId === null) parents.push(collection);
    else children.push(collection);
  }

  const keptParents = parents.slice(0, MAX_COLLECTIONS);
  const parentIds = new Set(keptParents.map((collection) => collection.id));
  const keptChildren = children
    .filter((collection) => collection.parentId !== null && parentIds.has(collection.parentId))
    .slice(0, MAX_COLLECTIONS - keptParents.length);
  return [...keptParents, ...keptChildren];
}

export function collectionNameError(name: string): string | undefined {
  const clean = name.replace(/[\r\n\t]+/g, ' ').trim();
  if (clean.length === 0) return 'Enter a name.';
  if (clean.length > MAX_NAME) return `Names can be up to ${MAX_NAME} characters.`;
  return undefined;
}

export function createCollection(
  collections: readonly PersonalCollection[],
  name: string,
  parentId: string | null,
): { collections: PersonalCollection[]; id?: string; error?: string } {
  const error = collectionNameError(name);
  if (error) return { collections: [...collections], error };
  if (collections.length >= MAX_COLLECTIONS) {
    return { collections: [...collections], error: `You can keep up to ${MAX_COLLECTIONS} collections.` };
  }
  if (parentId !== null) {
    const parent = collections.find((collection) => collection.id === parentId);
    if (!parent) return { collections: [...collections], error: 'That collection no longer exists.' };
    if (parent.parentId !== null) {
      return { collections: [...collections], error: 'A sub-collection cannot contain another collection.' };
    }
  }
  const created: PersonalCollection = {
    id: newCollectionId(),
    name: name.replace(/[\r\n\t]+/g, ' ').trim(),
    parentId,
    toolIds: [],
  };
  return { collections: [...collections, created], id: created.id };
}

export function renameCollection(
  collections: readonly PersonalCollection[],
  id: string,
  name: string,
): { collections: PersonalCollection[]; error?: string } {
  const error = collectionNameError(name);
  if (error) return { collections: [...collections], error };
  if (!collections.some((collection) => collection.id === id)) {
    return { collections: [...collections], error: 'That collection no longer exists.' };
  }
  const clean = name.replace(/[\r\n\t]+/g, ' ').trim();
  return {
    collections: collections.map((collection) => (collection.id === id ? { ...collection, name: clean } : collection)),
  };
}

/** Removes a collection and, when it is top-level, its sub-collections. */
export function deleteCollection(
  collections: readonly PersonalCollection[],
  id: string,
): { collections: PersonalCollection[]; removedIds: string[] } {
  const removedIds = collections
    .filter((collection) => collection.id === id || collection.parentId === id)
    .map((collection) => collection.id);
  return {
    collections: collections.filter((collection) => !removedIds.includes(collection.id)),
    removedIds,
  };
}

export function toggleToolInCollection(
  collections: readonly PersonalCollection[],
  collectionId: string,
  toolId: string,
): { collections: PersonalCollection[]; error?: string; added?: boolean } {
  const collection = collections.find((item) => item.id === collectionId);
  if (!collection) return { collections: [...collections], error: 'That collection no longer exists.' };
  if (collection.toolIds.includes(toolId)) {
    return {
      collections: collections.map((item) =>
        item.id === collectionId ? { ...item, toolIds: item.toolIds.filter((id) => id !== toolId) } : item,
      ),
      added: false,
    };
  }
  if (collection.toolIds.length >= MAX_TOOLS) {
    return { collections: [...collections], error: `A collection can hold up to ${MAX_TOOLS} tools.` };
  }
  return {
    collections: collections.map((item) =>
      item.id === collectionId ? { ...item, toolIds: [...item.toolIds, toolId] } : item,
    ),
    added: true,
  };
}

export function childCollections(collections: readonly PersonalCollection[], parentId: string): PersonalCollection[] {
  return collections.filter((collection) => collection.parentId === parentId);
}
