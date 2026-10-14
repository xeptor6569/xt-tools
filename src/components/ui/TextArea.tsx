import type { JSX } from 'preact';

type Props = Omit<JSX.IntrinsicElements['textarea'], 'onInput' | 'value' | 'label'> & {
  label: string;
  value: string;
  onValue?: (value: string) => void;
  /** Hidden label, still read by screen readers. */
  hideLabel?: boolean;
};

// Safari reads autocorrect="off"; Preact's types only allow a boolean.
const SAFARI_NO_AUTOCORRECT = { autocorrect: 'off' } as Record<string, string>;

/**
 * Text area with privacy-preserving defaults (no spellcheck, autocomplete or
 * autocorrect). Translation is disabled on the whole tool area by ToolLayout.
 */
export default function TextArea({ label, value, onValue, hideLabel, id, class: className, ...rest }: Props) {
  const inputId = id ?? `ta-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return (
    <div class="flex flex-col gap-1">
      <label htmlFor={inputId} class={hideLabel ? 'sr-only' : 'text-sm font-medium'}>
        {label}
      </label>
      <textarea
        id={inputId}
        value={value}
        onInput={(e) => onValue?.(e.currentTarget.value)}
        spellcheck={false}
        autocomplete="off"
        autocapitalize="off"
        {...SAFARI_NO_AUTOCORRECT}
        data-gramm="false"
        rows={8}
        class={`min-h-40 w-full resize-y rounded-lg border border-border bg-bg p-3 font-mono text-sm text-fg ${String(className ?? '')}`}
        {...rest}
      />
    </div>
  );
}
