import { useState } from 'preact/hooks';
import { copyText } from '../../lib/clipboard.ts';
import { shareUrl } from '../../lib/url-state.ts';
import { buttonClass } from './Button.tsx';

interface Props {
  state: unknown;
}

/** Copies a link that contains the current input in the URL fragment. */
export default function ShareButton({ state }: Props) {
  const [message, setMessage] = useState('');
  return (
    <>
      <button
        type="button"
        class={buttonClass('secondary')}
        data-xt="share"
        onClick={async () => {
          try {
            const ok = await copyText(await shareUrl(state));
            setMessage(ok ? 'Link copied. Anyone with it can see this input.' : 'Copy failed.');
          } catch (e) {
            setMessage(e instanceof Error ? e.message : 'Could not create a link.');
          }
        }}
      >
        Copy share link
      </button>
      <span role="status" class="text-xs text-muted">
        {message}
      </span>
    </>
  );
}
