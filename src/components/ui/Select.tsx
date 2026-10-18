import { useId } from 'preact/hooks';
import Field, { controlClass } from './Field.tsx';

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  disabled?: boolean;
}

interface Props<T extends string> {
  label: string;
  value: T;
  options: ReadonlyArray<SelectOption<T>>;
  onValue: (value: T) => void;
  hint?: string;
  hideLabel?: boolean;
  id?: string;
}

export default function Select<T extends string>({ label, value, options, onValue, hint, hideLabel, id }: Props<T>) {
  const autoId = useId();
  const selectId = id ?? autoId;
  return (
    <Field id={selectId} label={label} hint={hint} hideLabel={hideLabel}>
      <select
        id={selectId}
        value={value}
        onChange={(e) => onValue(e.currentTarget.value as T)}
        aria-describedby={hint ? `${selectId}-hint` : undefined}
        class={controlClass}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}
