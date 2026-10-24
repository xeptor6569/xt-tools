// Fills the pinned strip and the collection chips on the home page. The static
// catalog underneath stays in the HTML so the page works without JavaScript.

import { categories, groupPinIds } from '../../categories.ts';
import { href } from '../../lib/href.ts';
import { pinAttr, type Pin } from '../../lib/library.ts';
import { LIBRARY_EVENT, loadCollections, loadPins, pruneStoredPins } from '../../lib/library-store.ts';
import { collectionChips, pinCards, type CatalogTool } from '../../lib/library-view.ts';
import { allTools } from '../../tools/registry.ts';

function catalogTools(): CatalogTool[] {
  return allTools().map(({ id, name, description, category, group }) => ({
    id,
    name,
    description,
    category,
    ...(group ? { group } : {}),
  }));
}

function liveCollections() {
  const known = new Set(allTools().map((tool) => tool.id));
  return loadCollections().map((collection) => ({
    ...collection,
    toolIds: collection.toolIds.filter((id) => known.has(id)),
  }));
}

function catalog() {
  return {
    toolIds: allTools().map((tool) => tool.id),
    categoryIds: categories.map((category) => category.id),
    groupIds: groupPinIds(),
  };
}

function pinButton(pin: Pin, label: string): HTMLButtonElement | undefined {
  const template = document.querySelector<HTMLTemplateElement>('#xt-pin-button');
  const button = template?.content.firstElementChild?.cloneNode(true);
  if (!(button instanceof HTMLButtonElement)) return undefined;
  button.dataset.xtPin = pinAttr(pin);
  button.dataset.xtPinLabel = label;
  button.setAttribute('aria-pressed', 'true');
  button.setAttribute('aria-label', `Unpin ${label}`);
  button.title = `Unpin ${label}`;
  return button;
}

function clear(node: HTMLElement): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

function renderPinned(root: HTMLElement, pins: Pin[], tools: CatalogTool[]): void {
  clear(root);
  const cards = pinCards(pins, tools, liveCollections(), href);
  if (cards.length === 0) return;

  const section = document.createElement('section');
  section.className = 'mb-8';
  section.setAttribute('aria-labelledby', 'pinned-title');

  const heading = document.createElement('h2');
  heading.id = 'pinned-title';
  heading.className = 'mb-3 text-xl font-semibold';
  heading.textContent = 'Pinned';

  const list = document.createElement('ul');
  list.className = 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3';

  for (const card of cards) {
    const item = document.createElement('li');
    item.className = 'flex h-full flex-col rounded-lg border border-border bg-surface';

    const link = document.createElement('a');
    link.href = card.href;
    link.className = 'flex flex-1 flex-col gap-1 p-4 text-fg no-underline';

    const eyebrow = document.createElement('span');
    eyebrow.className = 'text-xs text-muted';
    eyebrow.textContent = card.eyebrow;

    const title = document.createElement('span');
    title.className = 'font-semibold';
    title.textContent = card.title;

    const detail = document.createElement('span');
    detail.className = 'text-sm text-muted';
    detail.textContent = card.detail;

    link.append(eyebrow, title, detail);

    const footer = document.createElement('div');
    footer.className = 'flex items-center border-t border-border px-2 py-1';
    const button = pinButton(card.pin, card.unpinLabel);
    if (button) footer.append(button);

    item.append(link, footer);
    list.append(item);
  }

  section.append(heading, list);
  root.append(section);
}

function renderCollections(list: HTMLElement): void {
  clear(list);
  const pins = loadPins();
  for (const chip of collectionChips(liveCollections(), href)) {
    const item = document.createElement('li');
    item.className = 'inline-flex items-center rounded-full border border-border bg-surface';

    const link = document.createElement('a');
    link.href = chip.href;
    link.className = 'py-1 pr-1 pl-3 text-sm text-fg no-underline';
    link.setAttribute('aria-label', `${chip.name}, ${chip.detail}`);

    const name = document.createElement('span');
    name.className = 'font-medium';
    name.textContent = chip.name;
    const detail = document.createElement('span');
    detail.className = 'ml-2 text-muted';
    detail.textContent = chip.detail;
    link.append(name, detail);

    item.append(link);
    const pinned = pins.some((pin) => pin.kind === 'collection' && pin.id === chip.id);
    const button = pinButton({ kind: 'collection', id: chip.id }, chip.unpinLabel);
    if (button) {
      button.setAttribute('aria-pressed', pinned ? 'true' : 'false');
      const action = pinned ? 'Unpin' : 'Pin';
      button.setAttribute('aria-label', `${action} ${chip.unpinLabel}`);
      button.title = `${action} ${chip.unpinLabel}`;
      item.append(button);
    }
    list.append(item);
  }
}

export function mountHomePersonal(): void {
  const pinned = document.querySelector<HTMLElement>('[data-xt="pinned"]');
  const collections = document.querySelector<HTMLElement>('[data-xt="collection-list"]');
  if (!pinned || !collections) return;

  let rendering = false;
  const render = (): void => {
    if (rendering) return;
    rendering = true;
    try {
      const tools = catalogTools();
      const collectionsNow = liveCollections();
      const pins = pruneStoredPins(
        catalog(),
        collectionsNow.map((collection) => collection.id),
      );
      renderPinned(pinned, pins, tools);
      renderCollections(collections);
    } finally {
      rendering = false;
    }
  };

  render();
  window.addEventListener(LIBRARY_EVENT, render);
}
