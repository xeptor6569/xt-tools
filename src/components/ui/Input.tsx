import type { JSX } from 'preact';
import { useId } from 'preact/hooks';
import Field, { controlClass, privateInputProps, SAFARI_NO_AUTOCORRECT } from './Field.tsx';

type Props = Omit<JSX.IntrinsicElements['input'], 'onInput' | 'value' | 'label'> & {
  label: string;
  value: string | number;
  onValue?: (value: string) => void;
  hint?: string;
  hideLabel?: boolean;
};

export default function Input({ label, value, onValue, hint, hideLabel, id, class: className, ...rest }: Props) {
  const autoId = useId();
  const inputId = typeof id === 'string' ? id : autoId;
  return (
    <Field id={inputId} label={label} hint={hint} hideLabel={hideLabel}>
      <input
        id={inputId}
        value={value}
        onInput={(e) => onValue?.(e.currentTarget.value)}
        {...privateInputProps}
        {...SAFARI_NO_AUTOCORRECT}
        aria-describedby={hint ? `${inputId}-hint` : undefined}
        class={`${controlClass} ${String(className ?? '')}`}
        {...rest}
      />
    </Field>
  );
}
