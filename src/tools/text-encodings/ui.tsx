import { useMemo, useState } from 'preact/hooks';
import CopyButton from '../../components/ui/CopyButton.tsx';
import ErrorMessage from '../../components/ui/ErrorMessage.tsx';
import ExampleButton from '../../components/ui/ExampleButton.tsx';
import KeyValueList from '../../components/ui/KeyValueList.tsx';
import OutputRegion from '../../components/ui/OutputRegion.tsx';
import Select from '../../components/ui/Select.tsx';
import Tabs from '../../components/ui/Tabs.tsx';
import TextArea from '../../components/ui/TextArea.tsx';
import { runTool } from '../../lib/run-tool.ts';
import { decodeFrom, ENCODINGS, encodeAll, type Encoding } from './logic.ts';
import meta from './meta.ts';

type Mode = 'encode' | 'decode';

export default function TextEncodingsTool() {
  const [mode, setMode] = useState<Mode>('encode');
  const [input, setInput] = useState('');
  const [encoding, setEncoding] = useState<Encoding>('quoted-printable');
  const encoded = useMemo(() => runTool(() => (mode === 'encode' ? encodeAll(input) : [])), [mode, input]);
  const decoded = useMemo(
    () => runTool(() => (mode === 'decode' && input !== '' ? decodeFrom(input, encoding) : '')),
    [mode, input, encoding],
  );

  return (
    <Tabs
      label="Direction"
      value={mode}
      onValue={setMode}
      tabs={[
        { id: 'encode', label: 'Encode' },
        { id: 'decode', label: 'Decode' },
      ]}
    >
      <div class="flex flex-col gap-4">
        {mode === 'decode' && <Select label="Decode from" value={encoding} options={ENCODINGS} onValue={setEncoding} />}
        <TextArea
          label={mode === 'encode' ? 'Text' : 'Encoded text'}
          value={input}
          onValue={setInput}
          rows={5}
          class="min-h-28"
          data-xt="input"
        />
        {mode === 'encode' && <ExampleButton examples={meta.examples} onPick={setInput} />}
        <OutputRegion label={mode === 'encode' ? 'Encoded forms' : 'Decoded text'}>
          {mode === 'encode' && encoded.output && encoded.output.length > 0 && <KeyValueList items={encoded.output} />}
          {mode === 'decode' && decoded.output !== undefined && decoded.output !== '' && (
            <>
              <TextArea label="Decoded text" value={decoded.output} readOnly rows={5} class="min-h-28" />
              <div>
                <CopyButton text={decoded.output} />
              </div>
            </>
          )}
          <ErrorMessage message={mode === 'encode' ? encoded.error : decoded.error} />
        </OutputRegion>
      </div>
    </Tabs>
  );
}
