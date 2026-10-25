import { useCallback, useEffect, useState } from 'preact/hooks';
import Button from '../../components/ui/Button.tsx';
import CopyButton from '../../components/ui/CopyButton.tsx';
import DownloadButton from '../../components/ui/DownloadButton.tsx';
import ErrorMessage from '../../components/ui/ErrorMessage.tsx';
import Input from '../../components/ui/Input.tsx';
import LoadingState from '../../components/ui/LoadingState.tsx';
import OutputRegion from '../../components/ui/OutputRegion.tsx';
import Select from '../../components/ui/Select.tsx';
import TextArea from '../../components/ui/TextArea.tsx';
import Toggle from '../../components/ui/Toggle.tsx';
import { errorMessage } from '../../lib/run-tool.ts';
import { MAX_WORDS, MIN_WORDS } from '../diceware/logic.ts';
import {
  DEFAULT_LENGTH,
  MAX_COUNT,
  MAX_LENGTH,
  MIN_LENGTH,
  parseCount,
  parseLength,
  parseWordCount,
  passphraseGenerator,
  passwordBits,
  passwordGenerator,
  type PasswordOptions,
  type Separator,
} from './logic.ts';

const random = (n: number) => crypto.getRandomValues(new Uint8Array(n));

type Mode = 'password' | 'passphrase';

const MODES = [
  { value: 'password', label: 'Password' },
  { value: 'passphrase', label: 'Passphrase' },
] as const satisfies ReadonlyArray<{ value: Mode; label: string }>;

const SEPARATORS = [
  { value: 'space', label: 'Spaces' },
  { value: 'hyphen', label: 'Hyphens' },
  { value: 'none', label: 'No separator' },
] as const satisfies ReadonlyArray<{ value: Separator; label: string }>;

export default function PasswordGeneratorTool() {
  const [mode, setMode] = useState<Mode>('password');
  const [countText, setCountText] = useState('1');
  const [lengthText, setLengthText] = useState(String(DEFAULT_LENGTH));
  const [wordsText, setWordsText] = useState('6');
  const [lower, setLower] = useState(true);
  const [upper, setUpper] = useState(true);
  const [digits, setDigits] = useState(true);
  const [symbols, setSymbols] = useState(true);
  const [excludeAmbiguous, setExcludeAmbiguous] = useState(true);
  const [separator, setSeparator] = useState<Separator>('space');
  const [capitalize, setCapitalize] = useState(false);
  const [wordlist, setWordlist] = useState<readonly string[] | null>(null);
  const [values, setValues] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (mode !== 'passphrase' || wordlist) return;
    let current = true;
    void import('../diceware/wordlist.ts').then(
      (mod) => {
        if (current) setWordlist(mod.EFF_LARGE_WORDLIST);
      },
      (e: unknown) => {
        if (current) setError(errorMessage(e));
      },
    );
    return () => {
      current = false;
    };
  }, [mode, wordlist]);

  const generate = useCallback(() => {
    try {
      const count = parseCount(countText);
      if (mode === 'password') {
        const options: PasswordOptions = {
          length: parseLength(lengthText),
          lower,
          upper,
          digits,
          symbols,
          excludeAmbiguous,
        };
        setValues(passwordGenerator(count, options, random));
        setNote(`About ${passwordBits(options)} bits from a ${options.length}-character password.`);
      } else {
        if (!wordlist) {
          setValues([]);
          setNote('');
          return;
        }
        const words = parseWordCount(wordsText);
        setValues(passphraseGenerator(count, { words, separator, capitalize }, wordlist, random));
        setNote(`${words} words from the EFF large wordlist (7776 words).`);
      }
      setError(undefined);
    } catch (e) {
      setValues([]);
      setNote('');
      setError(errorMessage(e));
    }
  }, [
    mode,
    countText,
    lengthText,
    wordsText,
    lower,
    upper,
    digits,
    symbols,
    excludeAmbiguous,
    separator,
    capitalize,
    wordlist,
  ]);

  useEffect(generate, [generate]);

  const text = values.join('\n');
  const waiting = mode === 'passphrase' && !wordlist && !error;

  return (
    <div class="flex flex-col gap-4">
      {waiting && <LoadingState label="Loading the EFF word list…" />}
      <div class="flex flex-wrap items-end gap-3">
        <Select label="Kind" value={mode} options={MODES} onValue={setMode} />
        {mode === 'password' ? (
          <Input
            label={`Length (${MIN_LENGTH}–${MAX_LENGTH})`}
            value={lengthText}
            onValue={setLengthText}
            inputMode="numeric"
            class="w-36"
            data-xt="input"
          />
        ) : (
          <Input
            label={`Words (${MIN_WORDS}–${MAX_WORDS})`}
            value={wordsText}
            onValue={setWordsText}
            inputMode="numeric"
            class="w-36"
            data-xt="input"
          />
        )}
        <Input
          label={`How many (1–${MAX_COUNT})`}
          value={countText}
          onValue={setCountText}
          inputMode="numeric"
          class="w-36"
        />
        <Button variant="primary" onClick={generate} disabled={waiting}>
          Generate
        </Button>
      </div>
      {mode === 'password' ? (
        <div class="flex flex-wrap gap-x-6">
          <Toggle label="Lowercase" checked={lower} onChecked={setLower} />
          <Toggle label="Uppercase" checked={upper} onChecked={setUpper} />
          <Toggle label="Digits" checked={digits} onChecked={setDigits} />
          <Toggle label="Symbols" checked={symbols} onChecked={setSymbols} />
          <Toggle
            label="Exclude ambiguous (0, O, 1, l, I)"
            checked={excludeAmbiguous}
            onChecked={setExcludeAmbiguous}
          />
        </div>
      ) : (
        <div class="flex flex-wrap items-end gap-x-6 gap-y-2">
          <Select label="Separator" value={separator} options={SEPARATORS} onValue={setSeparator} />
          <Toggle label="Capitalize words" checked={capitalize} onChecked={setCapitalize} />
        </div>
      )}
      <p class="text-xs text-muted">
        Generated with crypto.getRandomValues on this device. Nothing is stored.
        {note ? ` ${note}` : ''}
      </p>
      <OutputRegion label={mode === 'password' ? 'Password' : 'Passphrase'}>
        <TextArea label={mode === 'password' ? 'Password' : 'Passphrase'} hideLabel value={text} readOnly rows={6} />
        <div class="flex flex-wrap gap-2">
          <CopyButton text={text} />
          <DownloadButton data={text} filename={mode === 'password' ? 'password.txt' : 'passphrase.txt'} />
        </div>
        <ErrorMessage message={error} />
      </OutputRegion>
    </div>
  );
}
