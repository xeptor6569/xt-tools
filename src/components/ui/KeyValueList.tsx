import CopyButton from './CopyButton.tsx';

export interface KeyValueItem {
  label: string;
  value: string;
  /** Render the value in a monospace font (default true). */
  mono?: boolean;
  /** Extra explanation, e.g. "not cryptographic". */
  note?: string;
}

interface Props {
  items: readonly KeyValueItem[];
  copy?: boolean;
}

/** Label/value rows, each with its own copy button. */
export default function KeyValueList({ items, copy = true }: Props) {
  return (
    <dl class="divide-y divide-border rounded-lg border border-border" data-xt="kv">
      {items.map((item) => (
        <div key={item.label} class="flex flex-col gap-1 p-3 sm:flex-row sm:items-start sm:gap-4">
          <dt class="shrink-0 text-sm font-medium sm:w-40">
            {item.label}
            {item.note && <span class="block text-xs font-normal text-muted">{item.note}</span>}
          </dt>
          <dd class="flex min-w-0 flex-1 items-start gap-3">
            <span
              class={`min-w-0 flex-1 text-sm break-all ${item.mono === false ? '' : 'font-mono'}`}
              data-xt-value={item.label}
            >
              {item.value}
            </span>
            {copy && <CopyButton text={item.value} compact ariaLabel={`Copy ${item.label}`} />}
          </dd>
        </div>
      ))}
    </dl>
  );
}
