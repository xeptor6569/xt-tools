import { useState } from 'preact/hooks';
import OutputRegion from '../../components/ui/OutputRegion.tsx';
import { formatKey } from './logic.ts';

export default function KeycodeInfoTool() {
  const [text, setText] = useState('Press a key.');

  const onKeyDown = (event: KeyboardEvent) => {
    setText(
      formatKey({
        key: event.key,
        code: event.code,
        keyCode: event.keyCode,
        location: event.location,
        altKey: event.altKey,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
      }),
    );
  };

  return (
    <div class="flex flex-col gap-4">
      <button
        type="button"
        onKeyDown={onKeyDown}
        class="min-h-24 rounded-lg border border-border bg-surface px-4 py-6 text-center text-sm"
      >
        Focus this control and press a key. Tab still leaves the control.
      </button>
      <OutputRegion label="Last key">
        <pre class="font-mono text-sm whitespace-pre-wrap">{text}</pre>
      </OutputRegion>
    </div>
  );
}
