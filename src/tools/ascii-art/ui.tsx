import { useEffect, useMemo, useState } from 'preact/hooks';
import CopyButton from '../../components/ui/CopyButton.tsx';
import DownloadButton from '../../components/ui/DownloadButton.tsx';
import ErrorMessage from '../../components/ui/ErrorMessage.tsx';
import Input from '../../components/ui/Input.tsx';
import LoadingState from '../../components/ui/LoadingState.tsx';
import OutputRegion from '../../components/ui/OutputRegion.tsx';
import Select from '../../components/ui/Select.tsx';
import { errorMessage, runTool } from '../../lib/run-tool.ts';
import { FONT_NAMES, loadFont, type FontName } from './fonts.ts';
import { asciiArt, type Layout } from './logic.ts';

const LAYOUTS = [
  { value: 'default', label: 'Font default' },
  { value: 'fitted', label: 'Tight' },
  { value: 'full', label: 'Wide' },
] as const satisfies ReadonlyArray<{ value: Layout; label: string }>;

export default function AsciiArtTool() {
  const [text, setText] = useState('xt-tools');
  const [font, setFont] = useState<FontName>('Standard');
  const [layout, setLayout] = useState<Layout>('default');
  const [width, setWidth] = useState('80');
  const [data, setData] = useState<{ name: FontName; flf: string }>();
  const [loadError, setLoadError] = useState<string>();

  useEffect(() => {
    let current = true;
    loadFont(font).then(
      (flf) => current && setData({ name: font, flf }),
      (e: unknown) => current && setLoadError(errorMessage(e)),
    );
    return () => {
      current = false;
    };
  }, [font]);

  const ready = data?.name === font;
  const result = useMemo(
    () => runTool(() => (data ? asciiArt(text, data.name, data.flf, { layout, width: Number(width) || 80 }) : '')),
    [data, text, layout, width],
  );
  const art = result.output ?? '';

  return (
    <div class="flex flex-col gap-4">
      <Input label="Text" value={text} onValue={setText} maxLength={500} data-xt="input" />
      <div class="flex flex-wrap items-end gap-4">
        <Select label="Font" value={font} options={FONT_NAMES.map((f) => ({ value: f, label: f }))} onValue={setFont} />
        <Select label="Spacing" value={layout} options={LAYOUTS} onValue={setLayout} />
        <Input label="Wrap at (columns)" value={width} onValue={setWidth} inputMode="numeric" class="w-24" />
      </div>
      <OutputRegion label="ASCII art" busy={!ready}>
        {!ready && !loadError && <LoadingState label={`Loading the ${font} font…`} />}
        {art && (
          <pre
            class="overflow-x-auto rounded-lg border border-border bg-surface p-3 font-mono text-xs leading-tight"
            data-xt="art"
          >
            {art}
          </pre>
        )}
        <div class="flex flex-wrap gap-2">
          <CopyButton text={art} />
          <DownloadButton data={art} filename="ascii-art.txt" />
        </div>
        <ErrorMessage message={loadError ?? result.error} />
      </OutputRegion>
      <p class="text-xs text-muted">
        FIGlet fonts from the figlet package (MIT). Fonts are loaded from this site only when picked.
      </p>
    </div>
  );
}
