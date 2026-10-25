import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import FileDropZone from '../../components/ui/FileDropZone.tsx';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { loadImageElement } from '../../lib/image-file.ts';
import { runTool } from '../../lib/run-tool.ts';
import { paletteExtractor, quantizePalette } from './logic.ts';
import meta from './meta.ts';

function Swatch({ hex }: { hex: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.fillStyle = hex;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, [hex]);
  return (
    <canvas
      ref={ref}
      width={72}
      height={48}
      role="img"
      aria-label={hex}
      class="h-12 w-16 rounded-md border border-border"
    />
  );
}

function countFrom(input: string): number {
  const token = input.trim();
  if (/^\d+$/.test(token)) {
    const count = Number(token);
    if (count >= 1 && count <= 16) return count;
  }
  return 6;
}

export default function PaletteExtractorTool() {
  const [input, setInput] = useState('');
  const [fileText, setFileText] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string>();
  const [preferFile, setPreferFile] = useState(false);
  const text = useMemo(() => runTool(() => paletteExtractor(input)), [input]);
  const colors = (preferFile ? fileText : text.output)?.split('\n').filter((line) => line.startsWith('#')) ?? [];

  const onFiles = (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setPreferFile(true);
    setFileError(undefined);
    void (async () => {
      try {
        const image = await loadImageElement(file);
        const max = 96;
        const scale = Math.min(1, max / Math.max(image.naturalWidth, image.naturalHeight));
        const width = Math.max(1, Math.round(image.naturalWidth * scale));
        const height = Math.max(1, Math.round(image.naturalHeight * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('canvas');
        ctx.drawImage(image, 0, 0, width, height);
        const palette = quantizePalette(ctx.getImageData(0, 0, width, height).data, countFrom(input));
        setFileText(palette.length === 0 ? 'No colors.' : palette.join('\n'));
      } catch (error) {
        setFileText(null);
        setFileError(error instanceof Error ? error.message : 'Could not read that image.');
      }
    })();
  };

  return (
    <div class="flex flex-col gap-4">
      <p class="text-sm text-muted">
        Drop an image, or type a count and hex pixels such as 2 ff0000 0000ff. A lone number is how many colors to take
        from the image.
      </p>
      <FileDropZone label="Image" accept="image/*" maxBytes={25 * 1024 * 1024} onFiles={onFiles} />
      {colors.length > 0 && (
        <div class="flex flex-wrap gap-3">
          {colors.map((hex) => (
            <div key={hex} class="flex flex-col items-center gap-1">
              <Swatch hex={hex} />
              <span class="font-mono text-xs">{hex}</span>
            </div>
          ))}
        </div>
      )}
      <TwoPane
        inputLabel="Colors"
        input={input}
        onInput={(value) => {
          setPreferFile(false);
          setInput(value);
        }}
        inputPlaceholder="2 ff0000 0000ff"
        outputLabel="Palette"
        output={preferFile ? (fileText ?? '') : (text.output ?? '')}
        error={preferFile ? fileError : text.error}
        examples={meta.examples}
      />
    </div>
  );
}
