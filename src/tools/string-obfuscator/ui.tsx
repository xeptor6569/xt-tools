import { useMemo, useState } from 'preact/hooks';
import Input from '../../components/ui/Input.tsx';
import Toggle from '../../components/ui/Toggle.tsx';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { runTool } from '../../lib/run-tool.ts';
import { stringObfuscator } from './logic.ts';

const int = (s: string, fallback: number) => (/^\d+$/.test(s.trim()) ? Number(s) : fallback);

export default function StringObfuscatorTool() {
  const [input, setInput] = useState('');
  const [keepStart, setKeepStart] = useState('4');
  const [keepEnd, setKeepEnd] = useState('4');
  const [maskChar, setMaskChar] = useState('•');
  const [keepSeparators, setKeepSeparators] = useState(false);
  const [hideLength, setHideLength] = useState(false);
  const result = useMemo(
    () =>
      runTool(() =>
        stringObfuscator(input, {
          keepStart: int(keepStart, 4),
          keepEnd: int(keepEnd, 4),
          maskChar,
          keepSeparators,
          fixedLength: hideLength ? 8 : 0,
        }),
      ),
    [input, keepStart, keepEnd, maskChar, keepSeparators, hideLength],
  );

  return (
    <div class="flex flex-col gap-3">
      <TwoPane
        controls={
          <>
            <Input label="Keep at start" value={keepStart} onValue={setKeepStart} inputMode="numeric" class="w-20" />
            <Input label="Keep at end" value={keepEnd} onValue={setKeepEnd} inputMode="numeric" class="w-20" />
            <Input
              label="Mask character"
              value={maskChar}
              onValue={setMaskChar}
              maxLength={2}
              class="w-20 text-center"
            />
          </>
        }
        inputLabel="Secrets, one per line"
        input={input}
        onInput={setInput}
        outputLabel="Masked"
        output={result.output ?? ''}
        error={result.error}
      />
      <div class="flex flex-wrap gap-x-6">
        <Toggle label="Keep spaces, @, dots and dashes" checked={keepSeparators} onChecked={setKeepSeparators} />
        <Toggle label="Hide the length (always 8 mask characters)" checked={hideLength} onChecked={setHideLength} />
      </div>
    </div>
  );
}
