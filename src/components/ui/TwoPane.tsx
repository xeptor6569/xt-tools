import type { ComponentChildren } from 'preact';
import CopyButton from './CopyButton.tsx';
import ErrorMessage from './ErrorMessage.tsx';
import TextArea from './TextArea.tsx';

interface Props {
  inputLabel: string;
  input: string;
  onInput: (value: string) => void;
  inputPlaceholder?: string;
  outputLabel: string;
  output: string;
  error?: string | undefined;
  busy?: boolean;
  /** Extra controls rendered above the panes. */
  controls?: ComponentChildren;
}

/** Input on the left, read-only output with a copy button on the right. Stacks on small screens. */
export default function TwoPane(props: Props) {
  const { inputLabel, input, onInput, inputPlaceholder, outputLabel, output, error, busy, controls } = props;
  return (
    <div class="flex flex-col gap-4">
      {controls && <div class="flex flex-wrap items-end gap-4">{controls}</div>}
      <div class="grid gap-4 md:grid-cols-2">
        <TextArea
          label={inputLabel}
          value={input}
          onValue={onInput}
          data-xt="input"
          {...(inputPlaceholder ? { placeholder: inputPlaceholder } : {})}
        />
        <div class="flex flex-col gap-2">
          <TextArea
            label={outputLabel}
            value={output}
            readOnly
            data-xt="output"
            aria-busy={busy ? 'true' : undefined}
          />
          <div class="flex items-center gap-2">
            <CopyButton text={output} />
          </div>
          <ErrorMessage message={error} />
        </div>
      </div>
    </div>
  );
}
