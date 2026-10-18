import type { ComponentChildren } from 'preact';

interface Props {
  id: string;
  label: string;
  hint?: string | undefined;
  hideLabel?: boolean | undefined;
  children: ComponentChildren;
}

/** Label + control + optional hint, wired up with ids for assistive tech. */
export default function Field({ id, label, hint, hideLabel, children }: Props) {
  return (
    <div class="flex flex-col gap-1">
      <label htmlFor={id} class={hideLabel ? 'sr-only' : 'text-sm font-medium'}>
        {label}
      </label>
      {children}
      {hint && (
        <p id={`${id}-hint`} class="text-xs text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

export const controlClass = 'rounded-md border border-border bg-bg px-3 py-2 text-sm text-fg disabled:opacity-60';

/** Attributes that stop browsers and extensions from sending typed text elsewhere. */
export const privateInputProps = {
  spellcheck: false,
  autocomplete: 'off',
  autocapitalize: 'off',
  'data-gramm': 'false',
  'data-lt-active': 'false',
} as const;

// Safari reads autocorrect="off"; Preact's types only allow a boolean.
export const SAFARI_NO_AUTOCORRECT = { autocorrect: 'off' } as Record<string, string>;
