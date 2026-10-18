import type { JSX } from 'preact';
import { useId } from 'preact/hooks';
import Field, { privateInputProps, SAFARI_NO_AUTOCORRECT } from './Field.tsx';

type Props = Omit<JSX.IntrinsicElements['textarea'], 'onInput' | 'value' | 'label'> & {
  label: string;
  value: string;
  onValue?: (value: string) => void;
  hint?: string;
  /** Hidden label, still read by screen readers. */
  hideLabel?: boolean;
};

/**
 * Text area with privacy-preserving defaults (no spellcheck, autocomplete or
 * autocorrect). Translation is disabled on the whole tool area by ToolLayout.
 */
export default function TextArea({ label, value, onValue, hint, hideLabel, id, class: className, ...rest }: Props) {
  const autoId = useId();
  const inputId = typeof id === 'string' ? id : autoId;
  return (
    <Field id={inputId} label={label} hint={hint} hideLabel={hideLabel}>
      <textarea
        id={inputId}
        value={value}
        onInput={(e) => onValue?.(e.currentTarget.value)}
        {...privateInputProps}
        {...SAFARI_NO_AUTOCORRECT}
        aria-describedby={hint ? `${inputId}-hint` : undefined}
        rows={8}
        class={`min-h-40 w-full resize-y rounded-lg border border-border bg-bg p-3 font-mono text-sm text-fg ${String(className ?? '')}`}
        {...rest}
      />
    </Field>
  );
}
