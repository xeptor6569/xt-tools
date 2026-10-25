import { useId, useMemo, useState } from 'preact/hooks';
import Button from '../../components/ui/Button.tsx';
import CopyButton from '../../components/ui/CopyButton.tsx';
import ErrorMessage from '../../components/ui/ErrorMessage.tsx';
import SandboxedPreview from '../../components/ui/SandboxedPreview.tsx';
import TextArea from '../../components/ui/TextArea.tsx';
import { runTool } from '../../lib/run-tool.ts';
import { sanitizeHtml } from '../../lib/sanitize.ts';
import { HTML_WRAPS, prepareHtml, wrapSelection } from './logic.ts';

export default function HtmlEditorTool() {
  const [input, setInput] = useState('');
  const inputId = useId();
  const prepared = useMemo(() => runTool(() => prepareHtml(input)), [input]);
  const sanitized =
    prepared.output === undefined || typeof document === 'undefined' ? '' : sanitizeHtml(prepared.output);

  const wrap = (open: string, close: string) => {
    const el = document.getElementById(inputId);
    const start = el instanceof HTMLTextAreaElement ? el.selectionStart : input.length;
    const end = el instanceof HTMLTextAreaElement ? el.selectionEnd : input.length;
    const next = wrapSelection(input, start, end, open, close);
    setInput(next.text);
    requestAnimationFrame(() => {
      const area = document.getElementById(inputId);
      if (!(area instanceof HTMLTextAreaElement)) return;
      area.focus();
      area.setSelectionRange(next.start, next.end);
    });
  };

  return (
    <div class="flex flex-col gap-4">
      <div class="flex flex-wrap gap-2">
        {HTML_WRAPS.map((item) => (
          <Button key={item.label} onClick={() => wrap(item.open, item.close)}>
            {item.label}
          </Button>
        ))}
      </div>
      <TextArea id={inputId} label="HTML" value={input} onValue={setInput} rows={12} data-xt="input" />
      <TextArea label="Sanitized HTML" value={sanitized} readOnly rows={8} data-xt="output" />
      <SandboxedPreview html={prepared.output ?? ''} title="HTML preview" />
      <div class="flex flex-wrap gap-2">
        <CopyButton text={sanitized} label="Copy sanitized HTML" />
      </div>
      <ErrorMessage message={prepared.error} />
    </div>
  );
}
