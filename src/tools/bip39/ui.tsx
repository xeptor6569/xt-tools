import { useMemo, useState } from 'preact/hooks';
import Button from '../../components/ui/Button.tsx';
import Select from '../../components/ui/Select.tsx';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { errorMessage } from '../../lib/run-tool.ts';
import { bip39, mnemonicFromEntropy } from './logic.ts';
import meta from './meta.ts';

const STRENGTHS = [
  { value: '16', label: '12 words' },
  { value: '20', label: '15 words' },
  { value: '24', label: '18 words' },
  { value: '28', label: '21 words' },
  { value: '32', label: '24 words' },
] as const;

export default function Bip39Tool() {
  const [input, setInput] = useState('');
  const [bytes, setBytes] = useState('16');
  const [error, setError] = useState<string>();
  const result = useMemo(() => {
    try {
      return { output: bip39(input), error: undefined as string | undefined };
    } catch (e) {
      return { output: '', error: errorMessage(e) };
    }
  }, [input]);

  const generate = () => {
    try {
      const entropy = crypto.getRandomValues(new Uint8Array(Number(bytes)));
      setInput(mnemonicFromEntropy(entropy));
      setError(undefined);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <TwoPane
      inputLabel="Mnemonic"
      inputPlaceholder={
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about\n\nor:\npassphrase: TREZOR\nabandon abandon ... about'
      }
      input={input}
      onInput={setInput}
      outputLabel="Mnemonic and seed"
      output={result.output}
      error={error ?? result.error}
      examples={meta.examples}
      controls={
        <>
          <Select label="Length" value={bytes} options={STRENGTHS} onValue={setBytes} />
          <Button variant="primary" onClick={generate}>
            Generate
          </Button>
        </>
      }
    />
  );
}
