import { downloadBlob, toBlob, type Downloadable } from '../../lib/download.ts';
import { buttonClass } from './Button.tsx';

interface Props {
  /** The data, or a function that produces it when clicked (for expensive output). */
  data: Downloadable | (() => Downloadable | Promise<Downloadable>);
  filename: string;
  mime?: string;
  label?: string;
  disabled?: boolean;
}

export default function DownloadButton({
  data,
  filename,
  mime = 'text/plain;charset=utf-8',
  label = 'Download',
  disabled,
}: Props) {
  const empty = data === '' || (data instanceof Uint8Array && data.length === 0);
  return (
    <button
      type="button"
      disabled={disabled || empty}
      class={buttonClass('secondary')}
      data-xt="download"
      onClick={async () => {
        const value = typeof data === 'function' ? await data() : data;
        downloadBlob(toBlob(value, mime), filename);
      }}
    >
      {label}
    </button>
  );
}
