import { useEffect, useMemo, useState } from 'preact/hooks';
import DownloadButton from '../../components/ui/DownloadButton.tsx';
import LoadingState from '../../components/ui/LoadingState.tsx';
import Select from '../../components/ui/Select.tsx';
import Toggle from '../../components/ui/Toggle.tsx';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { useDebounced } from '../../components/ui/useDebounced.ts';
import { errorMessage, runTool } from '../../lib/run-tool.ts';
import { loadSqlFormatter } from './load.ts';
import {
  DIALECTS,
  formatSql,
  type Dialect,
  type Indent,
  type IndentStyle,
  type LetterCase,
  type SqlFormatFn,
} from './logic.ts';
import meta from './meta.ts';

const CASES = [
  { value: 'upper', label: 'UPPER' },
  { value: 'lower', label: 'lower' },
  { value: 'preserve', label: 'As written' },
] as const satisfies ReadonlyArray<{ value: LetterCase; label: string }>;

const INDENTS = [
  { value: '2', label: '2 spaces' },
  { value: '4', label: '4 spaces' },
  { value: 'tab', label: 'Tabs' },
] as const satisfies ReadonlyArray<{ value: Indent; label: string }>;

const STYLES = [
  { value: 'standard', label: 'Standard' },
  { value: 'tabularLeft', label: 'Tabular, keywords left' },
  { value: 'tabularRight', label: 'Tabular, keywords right' },
] as const satisfies ReadonlyArray<{ value: IndentStyle; label: string }>;

type Operators = 'before' | 'after';
const OPERATORS = [
  { value: 'before', label: 'Start of the line' },
  { value: 'after', label: 'End of the line' },
] as const satisfies ReadonlyArray<{ value: Operators; label: string }>;

type Gap = '0' | '1' | '2';
const GAPS = [
  { value: '0', label: 'None' },
  { value: '1', label: '1 line' },
  { value: '2', label: '2 lines' },
] as const satisfies ReadonlyArray<{ value: Gap; label: string }>;

export default function SqlFormatterTool() {
  const [input, setInput] = useState('');
  const [dialect, setDialect] = useState<Dialect>('sql');
  const [keywordCase, setKeywordCase] = useState<LetterCase>('upper');
  const [functionCase, setFunctionCase] = useState<LetterCase>('preserve');
  const [dataTypeCase, setDataTypeCase] = useState<LetterCase>('preserve');
  const [identifierCase, setIdentifierCase] = useState<LetterCase>('preserve');
  const [indent, setIndent] = useState<Indent>('2');
  const [indentStyle, setIndentStyle] = useState<IndentStyle>('standard');
  const [operators, setOperators] = useState<Operators>('before');
  const [gap, setGap] = useState<Gap>('1');
  const [denseOperators, setDenseOperators] = useState(false);
  const [newlineBeforeSemicolon, setNewlineBeforeSemicolon] = useState(false);
  const debounced = useDebounced(input, 200);

  const [format, setFormat] = useState<SqlFormatFn>();
  const [loadError, setLoadError] = useState<string>();
  useEffect(() => {
    let current = true;
    loadSqlFormatter().then(
      (fn) => current && setFormat(() => fn),
      (e: unknown) => current && setLoadError(errorMessage(e)),
    );
    return () => {
      current = false;
    };
  }, []);

  const result = useMemo(
    () =>
      runTool(() =>
        format
          ? formatSql(
              debounced,
              {
                dialect,
                keywordCase,
                functionCase,
                dataTypeCase,
                identifierCase,
                indent,
                indentStyle,
                logicalOperatorNewline: operators,
                linesBetweenQueries: Number(gap),
                denseOperators,
                newlineBeforeSemicolon,
              },
              format,
            )
          : '',
      ),
    [
      format,
      debounced,
      dialect,
      keywordCase,
      functionCase,
      dataTypeCase,
      identifierCase,
      indent,
      indentStyle,
      operators,
      gap,
      denseOperators,
      newlineBeforeSemicolon,
    ],
  );
  const output = result.output ?? '';

  return (
    <div class="flex flex-col gap-3">
      {!format && !loadError && <LoadingState label="Loading the SQL formatter…" />}
      <TwoPane
        controls={
          <>
            <Select label="Dialect" value={dialect} options={DIALECTS} onValue={setDialect} />
            <Select label="Keywords" value={keywordCase} options={CASES} onValue={setKeywordCase} />
            <Select label="Functions" value={functionCase} options={CASES} onValue={setFunctionCase} />
            <Select label="Data types" value={dataTypeCase} options={CASES} onValue={setDataTypeCase} />
            <Select label="Identifiers" value={identifierCase} options={CASES} onValue={setIdentifierCase} />
            <Select label="Indentation" value={indent} options={INDENTS} onValue={setIndent} />
            <Select label="Layout" value={indentStyle} options={STYLES} onValue={setIndentStyle} />
            <Select label="AND / OR placement" value={operators} options={OPERATORS} onValue={setOperators} />
            <Select label="Between queries" value={gap} options={GAPS} onValue={setGap} />
            <Toggle label="Dense operators (a=1)" checked={denseOperators} onChecked={setDenseOperators} />
            <Toggle
              label="Semicolon on its own line"
              checked={newlineBeforeSemicolon}
              onChecked={setNewlineBeforeSemicolon}
            />
          </>
        }
        inputLabel="SQL"
        input={input}
        onInput={setInput}
        inputPlaceholder="select * from users where id = 1"
        outputLabel="Formatted SQL"
        output={output}
        error={loadError ?? result.error}
        busy={!format || debounced !== input}
        examples={meta.examples}
        actions={<DownloadButton data={output} filename="formatted.sql" mime="application/sql;charset=utf-8" />}
      />
      <p class="text-xs text-muted">
        Formatting uses the sql-formatter library (MIT), loaded from this site. Only whitespace and letter case change;
        strings and comments are kept as written.
      </p>
    </div>
  );
}
