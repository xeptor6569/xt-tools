import type { JSX } from 'preact';

type Variant = 'primary' | 'secondary';

export function buttonClass(variant: Variant = 'secondary'): string {
  const base =
    'inline-flex min-h-9 items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60';
  return variant === 'primary'
    ? `${base} bg-accent text-accent-fg hover:opacity-90`
    : `${base} border border-border bg-surface text-fg hover:border-accent`;
}

type Props = JSX.IntrinsicElements['button'] & { variant?: Variant };

export default function Button({ variant = 'secondary', class: className, type = 'button', ...rest }: Props) {
  return <button type={type} class={`${buttonClass(variant)} ${String(className ?? '')}`} {...rest} />;
}
