import { useMemo, useState } from 'preact/hooks';
import Button from '../../components/ui/Button.tsx';
import Select from '../../components/ui/Select.tsx';
import Tabs from '../../components/ui/Tabs.tsx';
import Toggle from '../../components/ui/Toggle.tsx';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { useDebounced } from '../../components/ui/useDebounced.ts';
import { runTool } from '../../lib/run-tool.ts';
import {
  DEFAULT_OPTIONS,
  MODES,
  stringEscaper,
  type Direction,
  type EscapeMode,
  type EscapeOptions,
  type JsQuote,
} from './logic.ts';
import meta from './meta.ts';

const DIRECTIONS = [
  { id: 'escape', label: 'Escape' },
  { id: 'unescape', label: 'Unescape' },
] as const satisfies ReadonlyArray<{ id: Direction; label: string }>;

const QUOTES = [
  { value: "'", label: "Single quotes '…'" },
  { value: '"', label: 'Double quotes "…"' },
  { value: '`', label: 'Template literal `…`' },
] as const satisfies ReadonlyArray<{ value: JsQuote; label: string }>;

const HINTS: Record<EscapeMode, string> = {
  json: 'Backslash escapes for the inside of a JSON string. Unescape accepts the text with or without its quotes.',
  js: 'Backslash escapes for a JavaScript string literal. Unescape rejects legacy octal escapes.',
  c: 'Backslash escapes valid in both C and Java; other control characters become three-digit octal escapes.',
  sql: 'Standard SQL doubles single quotes. MySQL’s default mode also understands backslash escapes.',
  shell:
    'Wraps the text in single quotes, which the shell never expands. Unescape parses one word without expanding $ or globs.',
  powershell:
    'Single-quoted PowerShell string; curly quotes are doubled too. Unescape also reads double-quoted strings with backtick escapes.',
  regex: 'Escapes every regular-expression metacharacter so the text matches literally (safe with the u flag).',
  csv: 'Quotes the field only when it contains a comma, a quote or a line break, and doubles its quotes.',
  'xml-text': 'Escapes &, < and > for element content. Unescape knows the XML entities and common HTML ones.',
  'xml-attr': 'Also escapes quotes, tabs and line breaks, so the value survives in either kind of attribute quotes.',
};

const ASCII_MODES: readonly EscapeMode[] = ['json', 'js', 'c'];
const WRAP_MODES: readonly EscapeMode[] = ['json', 'js', 'c', 'sql'];

export default function StringEscaperTool() {
  const [input, setInput] = useState('');
  const [options, setOptions] = useState<EscapeOptions>(DEFAULT_OPTIONS);
  const set =
    <K extends keyof EscapeOptions>(key: K) =>
    (value: EscapeOptions[K]) =>
      setOptions((o) => ({ ...o, [key]: value }));
  const debounced = useDebounced(input, 100);

  const result = useMemo(() => runTool(() => stringEscaper(debounced, options)), [debounced, options]);
  const output = result.output ?? '';
  const { mode, direction } = options;
  const escaping = direction === 'escape';

  const swap = () => {
    setInput(output);
    setOptions((o) => ({ ...o, direction: o.direction === 'escape' ? 'unescape' : 'escape' }));
  };

  return (
    <Tabs label="Direction" tabs={DIRECTIONS} value={direction} onValue={set('direction')}>
      <div class="flex flex-col gap-3">
        <TwoPane
          controls={
            <>
              <Select label="Syntax" value={mode} options={MODES} onValue={set('mode')} />
              {mode === 'js' && escaping && (
                <Select label="Quote" value={options.quote} options={QUOTES} onValue={set('quote')} />
              )}
              {ASCII_MODES.includes(mode) && escaping && (
                <Toggle label="Escape non-ASCII" checked={options.asciiOnly} onChecked={set('asciiOnly')} />
              )}
              {mode === 'js' && escaping && options.asciiOnly && (
                <Toggle
                  label={'Use \\u{…} for emoji and other astral characters'}
                  checked={options.codePointEscapes}
                  onChecked={set('codePointEscapes')}
                />
              )}
              {WRAP_MODES.includes(mode) && escaping && (
                <Toggle label="Add surrounding quotes" checked={options.wrap} onChecked={set('wrap')} />
              )}
              {mode === 'sql' && (
                <Toggle label="MySQL backslash escapes" checked={options.mysql} onChecked={set('mysql')} />
              )}
              {mode === 'csv' && escaping && (
                <Toggle label="Always quote" checked={options.alwaysQuote} onChecked={set('alwaysQuote')} />
              )}
            </>
          }
          inputLabel={escaping ? 'Text' : 'Escaped string'}
          input={input}
          onInput={setInput}
          outputLabel={escaping ? 'Escaped string' : 'Text'}
          output={output}
          error={result.error}
          examples={meta.examples}
          actions={
            <Button onClick={swap} disabled={output === ''}>
              Swap and {escaping ? 'unescape' : 'escape'}
            </Button>
          }
        />
        <p class="text-sm text-muted">{HINTS[mode]}</p>
      </div>
    </Tabs>
  );
}
