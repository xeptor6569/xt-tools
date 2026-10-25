// Wires the header search box. The catalog JSON is fetched the first time
// someone types, focuses with a query, or clicks a tag.
import { toolHref } from '../../lib/href.ts';
import { loadLocalAsset } from '../../lib/load-local-asset.ts';
import { highlight, searchTools, type SearchDocument, type SearchHit } from '../../lib/search.ts';

let catalog: Promise<SearchDocument[]> | undefined;
let hits: SearchHit[] = [];
let active = -1;
let request = 0;

function loadCatalog(): Promise<SearchDocument[]> {
  catalog ??= loadLocalAsset('search-index.json')
    .then((response) => response.json() as Promise<SearchDocument[]>)
    .then((body) => {
      if (!Array.isArray(body)) throw new Error('Search index is not a list.');
      return body;
    });
  return catalog;
}

function typingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

function appendHighlight(parent: HTMLElement, text: string, query: string): void {
  for (const part of highlight(text, query)) {
    if (!part.match) {
      parent.append(document.createTextNode(part.text));
      continue;
    }
    const mark = document.createElement('mark');
    mark.className = 'bg-warning-bg text-fg';
    mark.textContent = part.text;
    parent.append(mark);
  }
}

export function installSearch(): void {
  const form = document.querySelector<HTMLFormElement>('[data-xt="search"]');
  const input = form?.querySelector<HTMLInputElement>('#tool-search');
  const panel = form?.querySelector<HTMLElement>('[data-xt="search-panel"]');
  const list = form?.querySelector<HTMLElement>('[data-xt="search-list"]');
  const empty = form?.querySelector<HTMLElement>('[data-xt="search-empty"]');
  const more = form?.querySelector<HTMLElement>('[data-xt="search-more"]');
  const status = form?.querySelector<HTMLElement>('[data-xt="search-status"]');
  if (!form || !input || !panel || !list || !empty || !more || !status) return;

  const byId = new Map<string, SearchDocument>();

  function setOpen(open: boolean): void {
    panel!.hidden = !open;
    input!.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (!open) input!.removeAttribute('aria-activedescendant');
  }

  function paintActive(): void {
    const options = list!.querySelectorAll<HTMLElement>('[role="option"]');
    options.forEach((option, index) => {
      const on = index === active;
      option.setAttribute('aria-selected', on ? 'true' : 'false');
      option.classList.toggle('bg-surface', on);
    });
    const current = active >= 0 ? options.item(active) : null;
    if (current?.id) input!.setAttribute('aria-activedescendant', current.id);
    else input!.removeAttribute('aria-activedescendant');
  }

  function render(query: string, message: string): void {
    list!.replaceChildren();
    more!.hidden = true;
    if (hits.length === 0) {
      empty!.hidden = false;
      empty!.textContent = message;
      list!.hidden = true;
      status!.textContent = message;
      active = -1;
      setOpen(true);
      return;
    }
    empty!.hidden = true;
    list!.hidden = false;
    const docs = hits.flatMap((hit) => {
      const doc = byId.get(hit.id);
      return doc ? [doc] : [];
    });
    docs.forEach((doc, index) => {
      const link = document.createElement('a');
      link.id = `tool-search-opt-${index}`;
      link.role = 'option';
      link.tabIndex = -1;
      link.href = toolHref(doc.id);
      link.className = 'block rounded-md px-3 py-2 text-fg no-underline hover:bg-surface';
      link.setAttribute('aria-selected', 'false');
      const title = document.createElement('span');
      title.className = 'block font-semibold';
      appendHighlight(title, doc.name, query);
      const detail = document.createElement('span');
      detail.className = 'mt-0.5 block text-sm text-muted';
      appendHighlight(detail, doc.description, query);
      const meta = document.createElement('span');
      meta.className = 'mt-1 block text-xs text-muted';
      meta.textContent = [...doc.tags, doc.categoryLabel].join(' · ');
      link.append(title, detail, meta);
      list!.append(link);
    });
    if (active >= docs.length) active = docs.length - 1;
    if (active < 0) active = 0;
    paintActive();
    setOpen(true);
  }

  function announce(shown: number, total: number): void {
    const text =
      total === 0 ? 'No tools match that search.' : total > shown ? `${shown} of ${total} tools` : `${total} tools`;
    status!.textContent = text;
    if (total > shown) {
      more!.hidden = false;
      more!.textContent = `Showing ${shown} of ${total}.`;
    }
  }

  async function run(query: string): Promise<void> {
    const trimmed = query.trim();
    if (trimmed === '') {
      hits = [];
      active = -1;
      list!.replaceChildren();
      empty!.hidden = true;
      more!.hidden = true;
      status!.textContent = '';
      setOpen(false);
      return;
    }
    const ticket = ++request;
    empty!.hidden = false;
    empty!.textContent = 'Loading the catalog…';
    list!.hidden = true;
    setOpen(true);
    status!.textContent = 'Loading the catalog…';
    try {
      const docs = await loadCatalog();
      if (ticket !== request) return;
      for (const doc of docs) byId.set(doc.id, doc);
      const result = searchTools(docs, trimmed);
      hits = result.hits;
      active = result.hits.length > 0 ? 0 : -1;
      render(trimmed, 'No tools match that search.');
      announce(result.hits.length, result.total);
    } catch {
      if (ticket !== request) return;
      hits = [];
      render(trimmed, 'The catalog could not be loaded.');
    }
  }

  function go(index: number): void {
    const option = list!.querySelectorAll<HTMLAnchorElement>('[role="option"]').item(index);
    if (option) window.location.assign(option.href);
  }

  input.addEventListener('input', () => {
    void run(input.value);
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (active >= 0) go(active);
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (hits.length === 0) return;
      active = Math.min(active + 1, hits.length - 1);
      setOpen(true);
      paintActive();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (hits.length === 0) return;
      active = Math.max(active - 1, 0);
      paintActive();
    } else if (event.key === 'Escape') {
      input.value = '';
      void run('');
    } else if (event.key === 'Enter' && active >= 0) {
      event.preventDefault();
      go(active);
    }
  });

  document.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    if ((event.ctrlKey || event.metaKey) && key === 'k') {
      event.preventDefault();
      input.focus();
      input.select();
      return;
    }
    if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey && !typingTarget(event.target)) {
      event.preventDefault();
      input.focus();
    }
  });

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const tagButton = target.closest('[data-xt-tag]');
    if (tagButton instanceof HTMLButtonElement) {
      const tag = tagButton.dataset.xtTag ?? '';
      if (tag === '') return;
      input.value = tag;
      input.focus();
      void run(tag);
      return;
    }
    if (!form.contains(target)) setOpen(false);
  });

  form.dataset.xtSearch = 'ready';
}
