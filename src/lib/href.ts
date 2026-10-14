// Builds internal URLs that respect the configured base path. Always use this
// instead of writing "/..." literals (lint enforces it).

const BASE = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;

/** `href('tools/slugify/')` → `/tools/slugify/` (or `/sub/tools/slugify/` under a base path). */
export function href(path = ''): string {
  return BASE + path.replace(/^\/+/, '');
}

export function toolHref(id: string): string {
  return href(`tools/${id}/`);
}

export function categoryHref(id: string): string {
  return href(`category/${id}/`);
}
