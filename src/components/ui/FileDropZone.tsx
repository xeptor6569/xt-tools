import { useId, useState } from 'preact/hooks';

interface Props {
  label: string;
  onFiles: (files: File[]) => void;
  /** e.g. "image/*,.pdf" */
  accept?: string;
  multiple?: boolean;
  /** Per-file limit in bytes. */
  maxBytes?: number;
  hint?: string;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
}

/** Drop files or pick them with the keyboard-accessible file input. Files never leave the browser. */
export default function FileDropZone({
  label,
  onFiles,
  accept,
  multiple = false,
  maxBytes = 100 * 1024 * 1024,
  hint,
}: Props) {
  const id = useId();
  const [over, setOver] = useState(false);
  const [error, setError] = useState('');

  const accept_ = (list: FileList | null) => {
    const files = [...(list ?? [])];
    const tooBig = files.filter((f) => f.size > maxBytes);
    setError(tooBig.length ? `${tooBig.map((f) => f.name).join(', ')}: larger than ${formatBytes(maxBytes)}.` : '');
    const ok = files.filter((f) => f.size <= maxBytes).slice(0, multiple ? undefined : 1);
    if (ok.length) onFiles(ok);
  };

  return (
    <div class="flex flex-col gap-1">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          accept_(e.dataTransfer?.files ?? null);
        }}
        class={`flex flex-col items-center gap-2 rounded-lg border-2 border-dashed p-6 text-center text-sm ${
          over ? 'border-accent bg-surface' : 'border-border'
        }`}
        data-xt="dropzone"
      >
        <label htmlFor={id} class="font-medium">
          {label}
        </label>
        <p class="text-muted">Drop {multiple ? 'files' : 'a file'} here, or choose:</p>
        <input
          id={id}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={(e) => {
            accept_(e.currentTarget.files);
            e.currentTarget.value = '';
          }}
          aria-describedby={hint ? `${id}-hint` : undefined}
          class="max-w-full text-sm file:mr-3 file:rounded-md file:border file:border-border file:bg-surface file:px-3 file:py-1.5 file:text-fg"
          data-xt="file-input"
        />
        <p class="text-xs text-muted" id={`${id}-hint`}>
          {hint ?? `Up to ${formatBytes(maxBytes)}${multiple ? ' per file' : ''}. Files stay on this device.`}
        </p>
      </div>
      {error && (
        <p role="alert" class="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
