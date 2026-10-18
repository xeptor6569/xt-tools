import LegacyNotice from './LegacyNotice.tsx';
import Select from './Select.tsx';

export interface AlgorithmOption<T extends string = string> {
  value: T;
  label: string;
  /** Why this option is legacy. Shown as a warning when it's selected. */
  legacy?: string;
}

interface Props<T extends string> {
  label: string;
  value: T;
  options: ReadonlyArray<AlgorithmOption<T>>;
  onValue: (value: T) => void;
  hint?: string;
}

/** Select for algorithms. Legacy options are labelled and warn when chosen; keep a secure default. */
export default function AlgorithmSelect<T extends string>({ label, value, options, onValue, hint }: Props<T>) {
  const selected = options.find((o) => o.value === value);
  return (
    <div class="flex flex-col gap-2">
      <Select
        label={label}
        value={value}
        onValue={onValue}
        options={options.map((o) => ({ value: o.value, label: o.legacy ? `${o.label} (legacy)` : o.label }))}
        {...(hint ? { hint } : {})}
      />
      {selected?.legacy && <LegacyNotice text={selected.legacy} />}
    </div>
  );
}
