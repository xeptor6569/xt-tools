// Theme handling. The bootstrap snippet runs inline in <head> before first
// paint (no flash of the wrong theme); its SHA-256 is added to the CSP in
// astro.config.ts, so it must be produced by this exact function.

export type Theme = 'system' | 'light' | 'dark';

export const THEME_KEY = 'theme';

/** Inline script that applies a stored theme. `base` is the configured base path. */
export function themeBootstrapScript(base: string): string {
  const key = JSON.stringify(`xt:${base}:${THEME_KEY}`);
  return `(function(){try{var t=JSON.parse(localStorage.getItem(${key})||'""');if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}})();`;
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = theme;
}
