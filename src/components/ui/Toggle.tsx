import { useId } from 'preact/hooks';

interface Props {
  label: string;
  checked: boolean;
  onChecked: (checked: boolean) => void;
  hint?: string;
  disabled?: boolean;
}

/** On/off switch built on a native checkbox, so it works with keyboard and screen readers. */
export default function Toggle({ label, checked, onChecked, hint, disabled }: Props) {
  const id = useId();
  return (
    <div class="flex flex-col gap-0.5 py-1">
      <label htmlFor={id} class="inline-flex cursor-pointer items-center gap-2 text-sm">
        <input
          id={id}
          type="checkbox"
          role="switch"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChecked(e.currentTarget.checked)}
          aria-describedby={hint ? `${id}-hint` : undefined}
          class="size-4 accent-accent"
        />
        {label}
      </label>
      {hint && (
        <p id={`${id}-hint`} class="pl-6 text-xs text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}
