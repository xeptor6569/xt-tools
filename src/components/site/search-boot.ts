// Shortcuts and buttons that open search. Fuse.js stays in a separate chunk
// until the first open.

let opening: Promise<void> | undefined;

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  if (target instanceof HTMLInputElement) {
    return target.type !== 'button' && target.type !== 'checkbox' && target.type !== 'radio' && target.type !== 'file';
  }
  return false;
}

function open(seed = ''): void {
  opening ??= import('./search-dialog.ts')
    .then((mod) => mod.openSearch(seed))
    .catch(() => {
      // A failed chunk load must not surface as an unhandled rejection.
    })
    .finally(() => {
      opening = undefined;
    });
}

export function installSearch(): void {
  document.addEventListener('keydown', (event) => {
    const command = (event.key === 'k' || event.key === 'K') && (event.metaKey || event.ctrlKey) && !event.altKey;
    if (command) {
      event.preventDefault();
      open();
      return;
    }
    if (event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey && !isTyping(event.target)) {
      event.preventDefault();
      open();
    }
  });

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (!target.closest('[data-xt="search-open"]')) return;
    event.preventDefault();
    open();
  });

  for (const field of document.querySelectorAll<HTMLInputElement>('[data-xt="search-field"]')) {
    field.addEventListener('focus', () => {
      const seed = field.value;
      field.value = '';
      open(seed);
    });
  }
}
