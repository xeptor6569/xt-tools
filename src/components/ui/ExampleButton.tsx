import type { ToolExample } from '../../tools/types.ts';
import { buttonClass } from './Button.tsx';

interface Props {
  examples: readonly ToolExample[] | undefined;
  onPick: (input: string) => void;
}

/** "Try an example" buttons, fed from the tool's metadata. */
export default function ExampleButton({ examples, onPick }: Props) {
  if (!examples?.length) return null;
  return (
    <div class="flex flex-wrap items-center gap-2 text-sm">
      <span class="text-muted">Try:</span>
      {examples.map((ex, i) => (
        <button
          key={i}
          type="button"
          class={`${buttonClass('secondary')} min-h-7 px-2 py-0.5 text-xs`}
          onClick={() => onPick(ex.input)}
        >
          {examples.length === 1 ? 'Example' : `Example ${i + 1}`}
        </button>
      ))}
    </div>
  );
}
