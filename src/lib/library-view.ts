// Display data for the pinned strip. Paths are finished by the caller so this
// stays independent of the base path.

import { getCategory, getGroup } from '../categories.ts';
import type { PersonalCollection, Pin } from './library.ts';

export interface CatalogTool {
  id: string;
  name: string;
  description: string;
  category: string;
  group?: string;
  added?: string;
}

export interface PinCard {
  pin: Pin;
  eyebrow: string;
  title: string;
  detail: string;
  href: string;
  unpinLabel: string;
}

export interface CollectionChip {
  id: string;
  name: string;
  href: string;
  detail: string;
  unpinLabel: string;
}

function countLabel(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function pinCards(
  pins: readonly Pin[],
  tools: readonly CatalogTool[],
  collections: readonly PersonalCollection[],
  href: (path: string) => string,
): PinCard[] {
  const cards: PinCard[] = [];
  for (const pin of pins) {
    if (pin.kind === 'tool') {
      const tool = tools.find((item) => item.id === pin.id);
      if (!tool) continue;
      const category = getCategory(tool.category);
      cards.push({
        pin,
        eyebrow: category?.label ?? 'Tool',
        title: tool.name,
        detail: tool.description,
        href: href(`tools/${tool.id}/`),
        unpinLabel: tool.name,
      });
      continue;
    }
    if (pin.kind === 'category') {
      const category = getCategory(pin.id);
      if (!category) continue;
      const count = tools.filter((tool) => tool.category === category.id).length;
      cards.push({
        pin,
        eyebrow: 'Category',
        title: category.label,
        detail: `${category.description} ${countLabel(count, 'tool')}.`,
        href: href(`category/${category.id}/`),
        unpinLabel: `the ${category.label} category`,
      });
      continue;
    }
    if (pin.kind === 'group') {
      const slash = pin.id.indexOf('/');
      if (slash <= 0) continue;
      const category = getCategory(pin.id.slice(0, slash));
      const group = category ? getGroup(category.id, pin.id.slice(slash + 1)) : undefined;
      if (!category || !group) continue;
      const count = tools.filter((tool) => tool.category === category.id && tool.group === group.id).length;
      cards.push({
        pin,
        eyebrow: category.label,
        title: group.label,
        detail: `${group.description} ${countLabel(count, 'tool')}.`,
        href: `${href(`category/${category.id}/`)}#${group.id}`,
        unpinLabel: `the ${group.label} group`,
      });
      continue;
    }
    const collection = collections.find((item) => item.id === pin.id);
    if (!collection) continue;
    const children = collections.filter((item) => item.parentId === collection.id).length;
    const extra = children > 0 ? ` · ${countLabel(children, 'sub-collection')}` : '';
    cards.push({
      pin,
      eyebrow: collection.parentId ? 'Sub-collection' : 'Collection',
      title: collection.name,
      detail: `${countLabel(collection.toolIds.length, 'tool')}${extra}. Kept on this device.`,
      href: `${href('collections/')}#c-${collection.id}`,
      unpinLabel: `the ${collection.name} collection`,
    });
  }
  return cards;
}

export function collectionChips(
  collections: readonly PersonalCollection[],
  href: (path: string) => string,
): CollectionChip[] {
  return collections
    .filter((collection) => collection.parentId === null)
    .map((collection) => {
      const children = collections.filter((item) => item.parentId === collection.id);
      const childTools = children.reduce((sum, child) => sum + child.toolIds.length, 0);
      const tools = collection.toolIds.length + childTools;
      const subs = children.length > 0 ? ` · ${countLabel(children.length, 'sub-collection')}` : '';
      return {
        id: collection.id,
        name: collection.name,
        href: `${href('collections/')}#c-${collection.id}`,
        detail: `${countLabel(tools, 'tool')}${subs}`,
        unpinLabel: `the ${collection.name} collection`,
      };
    });
}
