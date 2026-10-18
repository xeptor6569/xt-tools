import type { ComponentChildren } from 'preact';

interface Props {
  label: string;
  children: ComponentChildren;
  busy?: boolean;
}

/** Wraps tool output in a polite live region so screen readers hear updates. */
export default function OutputRegion({ label, children, busy }: Props) {
  return (
    <section
      aria-label={label}
      aria-live="polite"
      aria-busy={busy ? 'true' : 'false'}
      data-xt="output"
      class="flex flex-col gap-2"
    >
      {children}
    </section>
  );
}
