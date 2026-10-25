import { useCallback, useEffect, useState } from 'preact/hooks';
import Button from '../../components/ui/Button.tsx';
import CopyButton from '../../components/ui/CopyButton.tsx';
import DownloadButton from '../../components/ui/DownloadButton.tsx';
import ErrorMessage from '../../components/ui/ErrorMessage.tsx';
import Input from '../../components/ui/Input.tsx';
import LoadingState from '../../components/ui/LoadingState.tsx';
import OutputRegion from '../../components/ui/OutputRegion.tsx';
import TextArea from '../../components/ui/TextArea.tsx';
import { errorMessage } from '../../lib/run-tool.ts';
import { DEFAULT_WORDS, MAX_WORDS, MIN_WORDS, diceware, parseCount } from './logic.ts';

const random = (n: number) => crypto.getRandomValues(new Uint8Array(n));

export default function DicewareTool() {
  const [countText, setCountText] = useState(String(DEFAULT_WORDS));
  const [words, setWords] = useState<readonly string[] | null>(null);
  const [values, setValues] = useState<string[]>([]);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let current = true;
    void import('./wordlist.ts').then(
      (mod) => {
        if (current) setWords(mod.EFF_LARGE_WORDLIST);
      },
      (e: unknown) => {
        if (current) setError(errorMessage(e));
      },
    );
    return () => {
      current = false;
    };
  }, []);

  const generate = useCallback(() => {
    if (!words) return;
    try {
      setValues(diceware(parseCount(countText), random, words));
      setError(undefined);
    } catch (e) {
      setValues([]);
      setError(errorMessage(e));
    }
  }, [countText, words]);

  useEffect(generate, [generate]);

  const text = values.join('\n');
  return (
    <div class="flex flex-col gap-4">
      {!words && <LoadingState label="Loading the EFF word list…" />}
      <div class="flex flex-wrap items-end gap-3">
        <Input
          label={`Words (${MIN_WORDS}–${MAX_WORDS})`}
          value={countText}
          onValue={setCountText}
          inputMode="numeric"
          class="w-28"
          data-xt="input"
        />
        <Button variant="primary" onClick={generate} disabled={!words}>
          Generate
        </Button>
      </div>
      <p class="text-xs text-muted">
        Words come from the EFF large wordlist (7776 words). Each word is chosen with rejection sampling so the list is
        not biased.
      </p>
      <OutputRegion label="Passphrase">
        <TextArea label="Passphrase" hideLabel value={text} readOnly rows={4} />
        <div class="flex flex-wrap gap-2">
          <CopyButton text={text} />
          <DownloadButton data={text} filename="diceware.txt" />
        </div>
        <ErrorMessage message={error} />
      </OutputRegion>
    </div>
  );
}
