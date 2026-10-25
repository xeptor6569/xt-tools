import { useEffect, useState } from 'preact/hooks';
import LoadingState from '../../components/ui/LoadingState.tsx';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { errorMessage } from '../../lib/run-tool.ts';
import { phoneParser, preloadPhoneParser } from './logic.ts';
import meta from './meta.ts';

export default function PhoneParserTool() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let current = true;
    preloadPhoneParser().then(
      () => {
        if (current) setReady(true);
      },
      () => {
        if (current) setReady(true);
      },
    );
    return () => {
      current = false;
    };
  }, []);

  useEffect(() => {
    let current = true;
    setBusy(true);
    phoneParser(input)
      .then(
        (value) => {
          if (!current) return;
          setOutput(value);
          setError(undefined);
        },
        (e: unknown) => {
          if (!current) return;
          setOutput('');
          setError(errorMessage(e));
        },
      )
      .finally(() => {
        if (current) setBusy(false);
      });
    return () => {
      current = false;
    };
  }, [input]);

  return (
    <div class="flex flex-col gap-4">
      <p class="text-sm text-muted">
        A national number is read as a US number. Start with + and a country code for anywhere else.
      </p>
      {!ready && <LoadingState label="Loading phone metadata…" />}
      <TwoPane
        inputLabel="Phone number"
        inputPlaceholder="+442071838750"
        input={input}
        onInput={setInput}
        outputLabel="Parsed number"
        output={output}
        error={error}
        busy={busy || !ready}
        examples={meta.examples}
      />
    </div>
  );
}
