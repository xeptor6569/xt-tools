// Search dialog. Fuse.js and the index load the first time it opens.

import { toolHref } from '../../lib/href.ts';
import { isNew } from '../../lib/new-badge.ts';
import { loadRecents } from '../../lib/recents-store.ts';
import { loadSearcher, type SearchEntry } from '../../lib/search.ts';

let installed = false;
let searcher: ((query: string) => SearchEntry[]) | undefined;
let entries: readonly SearchEntry[] = [];
let active = 0;
let request = 0;
let returnFocus: HTMLElement | undefined;

function dialog(): HTMLDialogElement | undefined {
  const element = document.querySelector('[data-xt="search-dialog"]');
  return element instanceof HTMLDialogElement ? element : undefined;
}

function input(): HTMLInputElement | undefined {
  const element = document.querySelector('[data-xt="search-input"]');
  return element instanceof HTMLInputElement ? element : undefined;
}

function results(): HTMLElement | undefined {
  return document.querySelector<HTMLElement>('[data-xt="search-results"]') ?? undefined;
}

function hint(): HTMLElement | undefined {
  return document.querySelector<HTMLElement>('[data-xt="search-hint"]') ?? undefined;
}

function status(): HTMLElement | undefined {
  return document.querySelector<HTMLElement>('[data-xt="search-status"]') ?? undefined;
}

function clear(node: HTMLElement): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

function listed(query: string): { items: SearchEntry[]; recent: boolean } {
  const text = query.trim();
  if (!searcher) return { items: [], recent: false };
  if (text.length > 0) return { items: searcher(text), recent: false };
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const items = loadRecents().flatMap((id) => {
    const entry = byId.get(id);
    return entry ? [entry] : [];
  });
  return { items, recent: true };
}

function option(entry: SearchEntry, index: number): HTMLAnchorElement {
  const link = document.createElement('a');
  link.id = `xt-search-opt-${index}`;
  link.href = toolHref(entry.id);
  link.role = 'option';
  link.setAttribute('aria-selected', index === active ? 'true' : 'false');
  link.className = `flex flex-col gap-0.5 rounded-md px-3 py-2 text-fg no-underline ${index === active ? 'bg-surface' : ''}`;

  const row = document.createElement('span');
  row.className = 'flex items-center gap-2';
  const name = document.createElement('span');
  name.className = 'font-semibold';
  name.textContent = entry.name;
  row.append(name);
  if (isNew(entry)) {
    const badge = document.createElement('span');
    badge.className = 'rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-fg';
    badge.textContent = 'New';
    row.append(badge);
  }
  const category = document.createElement('span');
  category.className = 'ml-auto text-xs text-muted';
  category.textContent = entry.categoryLabel;
  row.append(category);

  const detail = document.createElement('span');
  detail.className = 'text-sm text-muted';
  detail.textContent = entry.description;
  link.append(row, detail);
  return link;
}

function render(): void {
  const field = input();
  const list = results();
  const note = hint();
  const live = status();
  if (!field || !list || !note || !live) return;

  if (!searcher) {
    field.setAttribute('aria-expanded', 'false');
    field.removeAttribute('aria-activedescendant');
    note.textContent = 'Loading search…';
    live.textContent = 'Loading search.';
    return;
  }

  const { items, recent } = listed(field.value);
  if (active >= items.length) active = 0;
  clear(list);
  items.forEach((entry, index) => {
    const link = option(entry, index);
    const item = document.createElement('li');
    item.role = 'presentation';
    item.append(link);
    list.append(item);
  });

  const current = items[active];
  field.setAttribute('aria-expanded', items.length > 0 ? 'true' : 'false');
  if (current) field.setAttribute('aria-activedescendant', `xt-search-opt-${active}`);
  else field.removeAttribute('aria-activedescendant');

  if (field.value.trim().length === 0) {
    note.textContent = recent && items.length > 0 ? 'Recent' : 'Type a name or keyword.';
    live.textContent = recent && items.length > 0 ? `${items.length} recent tools.` : 'Type a name or keyword.';
  } else if (items.length === 0) {
    note.textContent = 'No tools match.';
    live.textContent = 'No tools match.';
  } else {
    note.textContent = '';
    live.textContent = `${items.length} ${items.length === 1 ? 'tool' : 'tools'}.`;
  }

  document.getElementById(`xt-search-opt-${active}`)?.scrollIntoView({ block: 'nearest' });
}

async function ensureIndex(): Promise<void> {
  if (searcher) return;
  const loaded = await loadSearcher();
  entries = loaded.entries;
  searcher = loaded.search;
}

function move(step: number): void {
  const field = input();
  if (!field || !searcher) return;
  const count = listed(field.value).items.length;
  if (count === 0) return;
  active = (active + step + count) % count;
  render();
}

function choose(): void {
  const link = document.getElementById(`xt-search-opt-${active}`);
  if (link instanceof HTMLAnchorElement) link.click();
}

function install(): void {
  if (installed) return;
  const element = dialog();
  const field = input();
  if (!element || !field) return;
  installed = true;

  field.addEventListener('input', () => {
    active = 0;
    render();
  });
  element.addEventListener('keydown', (event) => {
    if (event.target !== field) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      move(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      move(-1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      choose();
    }
  });
  element.addEventListener('click', (event) => {
    if (event.target === element) element.close();
  });
  element.querySelector('[data-xt="search-close"]')?.addEventListener('click', () => element.close());
  element.addEventListener('close', () => {
    const target = returnFocus;
    returnFocus = undefined;
    // The 404 field opens search on focus, so sending focus back would reopen it.
    if (target?.isConnected && !target.matches('[data-xt="search-field"]')) target.focus();
    else document.querySelector<HTMLElement>('[data-xt="search-open"]')?.focus();
  });
}

/** Opens the dialog. `seed` is typed into the field before the first search. */
export async function openSearch(seed = ''): Promise<void> {
  install();
  const element = dialog();
  const field = input();
  if (!element || !field) return;
  if (!element.open) {
    returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    element.showModal();
  }
  if (seed) field.value = seed;
  field.focus();
  const ticket = ++request;
  render();
  try {
    await ensureIndex();
  } catch {
    if (ticket !== request) return;
    const note = hint();
    const live = status();
    if (note) note.textContent = 'Search could not be loaded.';
    if (live) live.textContent = 'Search could not be loaded.';
    return;
  }
  if (ticket !== request || !element.open) return;
  render();
}
