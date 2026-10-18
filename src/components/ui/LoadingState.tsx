interface Props {
  label?: string;
}

/** Announced loading indicator for heavy tools. */
export default function LoadingState({ label = 'Loading…' }: Props) {
  return (
    <p role="status" class="flex items-center gap-2 text-sm text-muted" data-xt="loading">
      <span
        class="inline-block size-4 animate-spin rounded-full border-2 border-border border-t-accent"
        aria-hidden="true"
      />
      {label}
    </p>
  );
}
