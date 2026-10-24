import { useMemo, useState } from 'preact/hooks';
import DownloadButton from '../../components/ui/DownloadButton.tsx';
import Input from '../../components/ui/Input.tsx';
import Select from '../../components/ui/Select.tsx';
import Toggle from '../../components/ui/Toggle.tsx';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { useDebounced } from '../../components/ui/useDebounced.ts';
import { runTool } from '../../lib/run-tool.ts';
import { FILE_EXTENSIONS, jsonToTypes, type Language, type PythonStyle, type TsDeclaration } from './logic.ts';
import meta from './meta.ts';

const LANGUAGES = [
  { value: 'typescript', label: 'TypeScript' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust (serde)' },
  { value: 'python', label: 'Python' },
] as const satisfies ReadonlyArray<{ value: Language; label: string }>;

const DECLARATIONS = [
  { value: 'interface', label: 'interface' },
  { value: 'type', label: 'type alias' },
] as const satisfies ReadonlyArray<{ value: TsDeclaration; label: string }>;

const PYTHON_STYLES = [
  { value: 'dataclass', label: '@dataclass' },
  { value: 'typeddict', label: 'TypedDict' },
] as const satisfies ReadonlyArray<{ value: PythonStyle; label: string }>;

export default function JsonToTypesTool() {
  const [input, setInput] = useState('');
  const [language, setLanguage] = useState<Language>('typescript');
  const [rootName, setRootName] = useState('Root');
  const [tsDeclaration, setTsDeclaration] = useState<TsDeclaration>('interface');
  const [tsExport, setTsExport] = useState(true);
  const [tsReadonly, setTsReadonly] = useState(false);
  const [pythonStyle, setPythonStyle] = useState<PythonStyle>('dataclass');
  const debounced = useDebounced(input, 150);

  const result = useMemo(
    () =>
      runTool(() => jsonToTypes(debounced, { language, rootName, tsDeclaration, tsExport, tsReadonly, pythonStyle })),
    [debounced, language, rootName, tsDeclaration, tsExport, tsReadonly, pythonStyle],
  );
  const output = result.output ?? '';

  return (
    <TwoPane
      controls={
        <>
          <Select label="Language" value={language} options={LANGUAGES} onValue={setLanguage} />
          <Input
            label="Root type name"
            value={rootName}
            onValue={setRootName}
            placeholder="Root"
            maxLength={60}
            class="w-40 font-mono"
          />
          {language === 'typescript' && (
            <>
              <Select label="Declare as" value={tsDeclaration} options={DECLARATIONS} onValue={setTsDeclaration} />
              <Toggle label="Add export" checked={tsExport} onChecked={setTsExport} />
              <Toggle label="readonly properties" checked={tsReadonly} onChecked={setTsReadonly} />
            </>
          )}
          {language === 'python' && (
            <Select label="Style" value={pythonStyle} options={PYTHON_STYLES} onValue={setPythonStyle} />
          )}
        </>
      }
      inputLabel="Sample JSON"
      input={input}
      onInput={setInput}
      inputPlaceholder='{"id": 1, "name": "Ada", "tags": ["math"]}'
      outputLabel={`${LANGUAGES.find((l) => l.value === language)?.label ?? 'Generated'} types`}
      output={output}
      error={result.error}
      examples={meta.examples}
      actions={<DownloadButton data={output} filename={`types.${FILE_EXTENSIONS[language]}`} />}
    />
  );
}
