import type { ComponentChildren } from 'preact';
import type { ToolExample } from '../../tools/types.ts';
import CopyButton from './CopyButton.tsx';
import ErrorMessage from './ErrorMessage.tsx';
import ExampleButton from './ExampleButton.tsx';
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
  /** Extra buttons next to Copy (e.g. Download). */
  actions?: ComponentChildren;
  examples?: readonly ToolExample[] | undefined;
}

/** Input on the left, read-only output with a copy button on the right. Stacks on small screens. */
export default function TwoPane(props: Props) {
  const {
    inputLabel,
    input,
    onInput,
    inputPlaceholder,
    outputLabel,
    output,
    error,
    busy,
    controls,
    actions,
    examples,
  } = props;
  return (
    <div class="flex flex-col gap-4">
      {controls && <div class="flex flex-wrap items-end gap-4">{controls}</div>}
      <div class="grid gap-4 md:grid-cols-2">
        <div class="flex flex-col gap-2">
          <TextArea
            label={inputLabel}
            value={input}
            onValue={onInput}
            data-xt="input"
            {...(inputPlaceholder ? { placeholder: inputPlaceholder } : {})}
          />
          <ExampleButton examples={examples} onPick={onInput} />
        </div>
        <div class="flex flex-col gap-2" aria-live="polite">
          <TextArea
            label={outputLabel}
            value={output}
            readOnly
            data-xt="output"
            aria-busy={busy ? 'true' : undefined}
          />
          <div class="flex flex-wrap items-center gap-2">
            <CopyButton text={output} />
            {actions}
          </div>
          <ErrorMessage message={error} />
        </div>
      </div>
    </div>
  );
}
