import { useMemo, useState } from 'preact/hooks';
import Button from '../../components/ui/Button.tsx';
import CopyButton from '../../components/ui/CopyButton.tsx';
import DownloadButton from '../../components/ui/DownloadButton.tsx';
import ErrorMessage from '../../components/ui/ErrorMessage.tsx';
import SandboxedPreview from '../../components/ui/SandboxedPreview.tsx';
import TextArea from '../../components/ui/TextArea.tsx';
import { useDebounced } from '../../components/ui/useDebounced.ts';
import { PREVIEW_CSS } from '../../lib/preview-css.ts';
import { runTool } from '../../lib/run-tool.ts';
import { sanitizeHtml } from '../../lib/sanitize.ts';
import { htmlDocument, markdownStats, markdownToHtml } from './logic.ts';

const START = `# Notes

Write **Markdown** on the left and see it on the right.

- [x] Live preview
- [ ] Copy the HTML or print to PDF

| Feature | Works offline |
| ------- | ------------- |
| Tables  | Yes           |
`;

function titleOf(md: string): string {
  return /^#\s+(.+)$/m.exec(md)?.[1]?.trim().slice(0, 80) || 'Document';
}

function printable(md: string, html: string): string {
  return htmlDocument(titleOf(md), sanitizeHtml(html), PREVIEW_CSS);
}

/** Opens the rendered document (sanitized, script-free by CSP) in a new tab and prints it. */
function print(md: string, html: string) {
  const url = URL.createObjectURL(new Blob([printable(md, html)], { type: 'text/html' }));
  const win = window.open(url, '_blank');
  if (!win) return;
  win.addEventListener('load', () => {
    win.print();
    URL.revokeObjectURL(url);
  });
}

export default function MarkdownEditorTool() {
  const [input, setInput] = useState(START);
  const md = useDebounced(input, 150);
  const result = useMemo(() => runTool(() => markdownToHtml(md)), [md]);
  const html = result.output ?? '';
  const stats = markdownStats(input);

  return (
    <div class="flex flex-col gap-3">
      <div class="grid gap-4 lg:grid-cols-2">
        <TextArea label="Markdown" value={input} onValue={setInput} rows={20} class="min-h-[60vh]" data-xt="input" />
        <div class="flex flex-col gap-1">
          <span class="text-sm font-medium">Preview</span>
          <SandboxedPreview html={html} title="Markdown preview" class="min-h-[60vh] flex-1" />
        </div>
      </div>
      <ErrorMessage message={result.error} />
      <div class="flex flex-wrap items-center gap-2">
        <CopyButton text={html} label="Copy HTML" />
        <CopyButton text={input} label="Copy Markdown" />
        <DownloadButton data={input} filename="document.md" mime="text/markdown;charset=utf-8" label="Download .md" />
        <DownloadButton
          data={() => printable(input, html)}
          filename="document.html"
          mime="text/html;charset=utf-8"
          label="Download .html"
        />
        <Button onClick={() => print(input, html)} disabled={!html}>
          Print / save as PDF
        </Button>
        <span class="ml-auto text-sm text-muted" aria-live="polite">
          {stats.words} words · {stats.headings} headings · {stats.links} links
        </span>
      </div>
      <p class="text-xs text-muted">
        Raw HTML in your Markdown is sanitized before display: scripts, styles, forms and remote images are removed.
      </p>
    </div>
  );
}
