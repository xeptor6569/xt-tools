import type { ComponentChildren } from 'preact';
import { useId, useRef } from 'preact/hooks';

export interface Tab<T extends string = string> {
  id: T;
  label: string;
}

interface Props<T extends string> {
  label: string;
  tabs: ReadonlyArray<Tab<T>>;
  value: T;
  onValue: (value: T) => void;
  /** Content of the selected tab. */
  children: ComponentChildren;
}

/** WAI-ARIA tabs: arrow keys move between tabs, Home/End jump to the ends. */
export default function Tabs<T extends string>({ label, tabs, value, onValue, children }: Props<T>) {
  const base = useId();
  const list = useRef<HTMLDivElement>(null);

  const focusTab = (index: number) => {
    const tab = tabs[(index + tabs.length) % tabs.length];
    if (!tab) return;
    onValue(tab.id);
    list.current?.querySelector<HTMLButtonElement>(`[data-tab="${tab.id}"]`)?.focus();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const current = tabs.findIndex((t) => t.id === value);
    const moves: Record<string, number> = {
      ArrowRight: current + 1,
      ArrowLeft: current - 1,
      Home: 0,
      End: tabs.length - 1,
    };
    const next = moves[e.key];
    if (next === undefined) return;
    e.preventDefault();
    focusTab(next);
  };

  return (
    <div class="flex flex-col gap-3">
      <div role="tablist" aria-label={label} ref={list} class="flex flex-wrap gap-1 border-b border-border">
        {tabs.map((t) => {
          const selected = t.id === value;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`${base}-tab-${t.id}`}
              data-tab={t.id}
              aria-selected={selected}
              aria-controls={`${base}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onValue(t.id)}
              onKeyDown={onKeyDown}
              class={`-mb-px rounded-t-md border-b-2 px-3 py-2 text-sm font-medium ${
                selected ? 'border-accent text-fg' : 'border-transparent text-muted hover:text-fg'
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id={`${base}-panel`} aria-labelledby={`${base}-tab-${value}`}>
        {children}
      </div>
    </div>
  );
}
