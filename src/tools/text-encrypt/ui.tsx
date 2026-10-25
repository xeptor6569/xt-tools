import { useEffect, useMemo, useState } from 'preact/hooks';
import AlgorithmSelect from '../../components/ui/AlgorithmSelect.tsx';
import LegacyNotice from '../../components/ui/LegacyNotice.tsx';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { errorMessage } from '../../lib/run-tool.ts';
import { CIPHERS, cipherFromInput, textEncrypt, type CipherName } from './logic.ts';
import meta from './meta.ts';

export default function TextEncryptTool() {
  const [input, setInput] = useState('');
  const [cipher, setCipher] = useState<CipherName>('aes-gcm');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const active = useMemo(() => cipherFromInput(input, cipher), [input, cipher]);
  const textLegacy = active !== cipher ? CIPHERS.find((c) => c.value === active)?.legacy : undefined;

  useEffect(() => {
    let current = true;
    setBusy(true);
    const random = crypto.getRandomValues(new Uint8Array(28));
    textEncrypt(input, { cipher, random })
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
  }, [input, cipher]);

  return (
    <div class="flex flex-col gap-4">
      {textLegacy && <LegacyNotice text={textLegacy} />}
      <TwoPane
        inputLabel="Password and text"
        inputPlaceholder={
          'password: secret\nn: 16384\nhello\n\nDecrypt:\nmode: decrypt\npassword: secret\nxt1.scrypt...'
        }
        input={input}
        onInput={setInput}
        outputLabel={active === 'aes-gcm' ? 'Ciphertext or plaintext' : 'Plaintext'}
        output={output}
        error={error}
        busy={busy}
        examples={meta.examples}
        controls={
          <AlgorithmSelect
            label="Cipher"
            value={cipher}
            options={CIPHERS}
            onValue={setCipher}
            hint="AES-GCM is the only cipher that encrypts. A cipher: line in the text overrides this menu."
          />
        }
      />
    </div>
  );
}
