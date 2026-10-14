interface Props {
  message: string | undefined;
}

/** Inline error, announced to screen readers when it appears. */
export default function ErrorMessage({ message }: Props) {
  return (
    <div role="alert" data-xt="error" class={message ? 'rounded-lg bg-danger-bg p-3 text-sm text-danger' : 'sr-only'}>
      {message ?? ''}
    </div>
  );
}
