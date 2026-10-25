import { useMemo, useState } from 'preact/hooks';
import SandboxedPreview from '../../components/ui/SandboxedPreview.tsx';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { runTool } from '../../lib/run-tool.ts';
import { socialPreview } from './logic.ts';
import meta from './meta.ts';

export default function SocialPreviewTool() {
  const [input, setInput] = useState('');
  const result = useMemo(() => runTool(() => socialPreview(input)), [input]);
  const card = result.output;

  return (
    <div class="flex flex-col gap-4">
      <TwoPane
        inputLabel="Title and description"
        inputPlaceholder="Title | description"
        input={input}
        onInput={setInput}
        outputLabel="Card text"
        output={card?.text ?? ''}
        error={result.error}
        examples={meta.examples}
      />
      {card?.html && <SandboxedPreview html={card.html} title="Social card preview" class="h-48" />}
    </div>
  );
}
