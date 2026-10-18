import { useEffect, useState } from 'preact/hooks';
import { copyText } from '../../lib/clipboard.ts';
import { buttonClass } from './Button.tsx';

interface Props {
  text: string;
  label?: string;
  /** Accessible name when several copy buttons share a screen, e.g. "Copy SHA-256". */
  ariaLabel?: string;
  compact?: boolean;
}

export default function CopyButton({ text, label = 'Copy', ariaLabel, compact }: Props) {
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
        class={compact ? `${buttonClass('secondary')} min-h-7 px-2 py-0.5 text-xs` : buttonClass('secondary')}
        aria-label={ariaLabel}
        data-xt="copy"
      >
        {state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : label}
      </button>
      <span role="status" class="sr-only">
        {state === 'copied' ? 'Copied to clipboard' : state === 'failed' ? 'Copy failed' : ''}
      </span>
    </>
  );
}
