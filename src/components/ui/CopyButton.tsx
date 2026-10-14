import { useEffect, useState } from 'preact/hooks';
import { copyText } from '../../lib/clipboard.ts';

interface Props {
  text: string;
  label?: string;
}

export default function CopyButton({ text, label = 'Copy' }: Props) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');

  useEffect(() => {
    if (state === 'idle') return;
    const t = setTimeout(() => setState('idle'), 2000);
    return () => clearTimeout(t);
  }, [state]);

  return (
    <>
      <button
        type="button"
        disabled={text === ''}
        onClick={async () => setState((await copyText(text)) ? 'copied' : 'failed')}
        class="rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-fg hover:border-accent disabled:cursor-not-allowed disabled:opacity-60"
        data-xt="copy"
      >
        {state === 'copied' ? 'Copied' : label}
      </button>
      <span role="status" class="sr-only">
        {state === 'copied' ? 'Copied to clipboard' : state === 'failed' ? 'Copy failed' : ''}
      </span>
    </>
  );
}
