import { useMemo, useState } from 'preact/hooks';
import Input from '../../components/ui/Input.tsx';
import Select from '../../components/ui/Select.tsx';
import TextArea from '../../components/ui/TextArea.tsx';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { runTool } from '../../lib/run-tool.ts';
import { formatSnippet, httpSnippet, parseSnippet } from './logic.ts';
import meta from './meta.ts';

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'].map((value) => ({ value, label: value }));

export default function HttpSnippetTool() {
  const [text, setText] = useState('');
  const result = useMemo(() => runTool(() => httpSnippet(text)), [text]);
  const parsed = useMemo(() => {
    if (text.trim() === '') return undefined;
    try {
      return parseSnippet(text);
    } catch {
      return undefined;
    }
  }, [text]);

  const write = (next: { method?: string; url?: string; headers?: string; body?: string }) => {
    const headers = parsed ? parsed.headers.map((header) => `${header.name}: ${header.value}`).join('\n') : '';
    setText(
      formatSnippet({
        method: next.method ?? parsed?.method ?? 'GET',
        url: next.url ?? parsed?.url ?? '',
        headers: next.headers ?? headers,
        body: next.body ?? parsed?.body ?? '',
      }),
    );
  };

  return (
    <TwoPane
      inputLabel="Request"
      inputPlaceholder={'POST https://…\nContent-Type: application/json\n\n{"ok":true}'}
      input={text}
      onInput={setText}
      outputLabel="Snippets"
      output={result.output ?? ''}
      error={result.error}
      examples={meta.examples}
      controls={
        <>
          <Select
            label="Method"
            value={parsed?.method ?? 'GET'}
            options={METHODS}
            onValue={(method) => write({ method })}
          />
          <Input label="URL" value={parsed?.url ?? ''} onValue={(url) => write({ url })} />
          <TextArea
            label="Headers"
            value={parsed ? parsed.headers.map((header) => `${header.name}: ${header.value}`).join('\n') : ''}
            onValue={(headers) => write({ headers })}
            rows={3}
            class="min-h-20"
          />
          <TextArea
            label="Body"
            value={parsed?.body ?? ''}
            onValue={(body) => write({ body })}
            rows={3}
            class="min-h-20"
          />
        </>
      }
    />
  );
}
