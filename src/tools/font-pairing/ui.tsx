import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import Button from '../../components/ui/Button.tsx';
import CopyButton from '../../components/ui/CopyButton.tsx';
import ErrorMessage from '../../components/ui/ErrorMessage.tsx';
import ExampleButton from '../../components/ui/ExampleButton.tsx';
import OutputRegion from '../../components/ui/OutputRegion.tsx';
import Select from '../../components/ui/Select.tsx';
import TextArea from '../../components/ui/TextArea.tsx';
import { runTool } from '../../lib/run-tool.ts';
import { BUILT_IN_FAMILIES, describeFonts } from './logic.ts';
import meta from './meta.ts';

interface LocalFont {
  family: string;
}

export default function FontPairingTool() {
  const [input, setInput] = useState('');
  const [installed, setInstalled] = useState<string[]>();
  const [fontNote, setFontNote] = useState<string>();
  const [canList, setCanList] = useState(false);
  const headingRef = useRef<HTMLParagraphElement>(null);
  const bodyRef = useRef<HTMLParagraphElement>(null);
  const result = useMemo(() => runTool(() => describeFonts(input)), [input]);
  const pair = result.output;
  const heading = pair?.heading ?? 'Georgia';
  const body = pair?.body ?? 'Palatino';
  const choices = [...new Set<string>([...BUILT_IN_FAMILIES, ...(installed ?? [])])];
  const optionsFor = (value: string) => (choices.includes(value) ? choices : [value, ...choices]);

  useEffect(() => {
    const fonts = globalThis as { queryLocalFonts?: unknown };
    setCanList(typeof fonts.queryLocalFonts === 'function');
  }, []);

  useEffect(() => {
    headingRef.current?.style.setProperty('--preview', pair?.headingStack ?? 'Georgia, sans-serif');
    bodyRef.current?.style.setProperty('--preview', pair?.bodyStack ?? 'Palatino, sans-serif');
  }, [pair]);

  async function listInstalled() {
    const fonts = globalThis as { queryLocalFonts?: () => Promise<LocalFont[]> };
    if (typeof fonts.queryLocalFonts !== 'function') {
      setFontNote('Installed fonts are not available. The preview uses the built-in stack.');
      return;
    }
    try {
      const listed = await fonts.queryLocalFonts();
      const families = [...new Set(listed.map((font) => font.family))].sort((a, b) => a.localeCompare(b));
      setInstalled(families);
      setFontNote(undefined);
    } catch {
      setFontNote('Installed fonts could not be listed. The preview still falls back through the built-in stack.');
    }
  }

  return (
    <div class="flex flex-col gap-4">
      <p class="text-sm text-muted">
        Type two family names separated by |. No web fonts are loaded. When installed fonts cannot be listed, the
        preview falls back through Georgia, Palatino, system-ui, sans-serif and monospace.
      </p>
      <div class="flex flex-wrap items-end gap-4">
        <Select
          label="Heading"
          value={heading}
          options={optionsFor(heading).map((value) => ({ value, label: value }))}
          onValue={(value) => setInput(`${value} | ${body}`)}
        />
        <Select
          label="Body"
          value={body}
          options={optionsFor(body).map((value) => ({ value, label: value }))}
          onValue={(value) => setInput(`${heading} | ${value}`)}
        />
        {canList && <Button onClick={() => void listInstalled()}>List installed fonts</Button>}
      </div>
      {fontNote && <p class="text-sm text-muted">{fontNote}</p>}
      <TextArea
        label="Heading and body"
        hint="Example: Georgia | Palatino"
        value={input}
        onValue={setInput}
        data-xt="input"
        rows={3}
      />
      <ExampleButton examples={meta.examples} onPick={setInput} />
      <div class="rounded-lg border border-border bg-surface p-4">
        <p ref={headingRef} class="[font-family:var(--preview)] text-3xl">
          The quick brown fox
        </p>
        <p ref={bodyRef} class="mt-2 max-w-prose [font-family:var(--preview)]">
          jumps over the lazy dog. This paragraph uses the body family and never downloads a font.
        </p>
      </div>
      <OutputRegion label="Families in use">
        <pre class="font-mono text-sm whitespace-pre-wrap">{pair?.text ?? ''}</pre>
        <CopyButton text={pair?.text ?? ''} />
        <ErrorMessage message={result.error} />
      </OutputRegion>
    </div>
  );
}
