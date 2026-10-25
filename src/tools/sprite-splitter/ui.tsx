import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import Button from '../../components/ui/Button.tsx';
import FileDropZone from '../../components/ui/FileDropZone.tsx';
import TwoPane from '../../components/ui/TwoPane.tsx';
import { downloadBlob } from '../../lib/download.ts';
import { loadImageElement } from '../../lib/image-file.ts';
import { runTool } from '../../lib/run-tool.ts';
import { ToolInputError } from '../types.ts';
import { formatFrames, frameRects, parseGrid, type FrameRect } from './logic.ts';
import meta from './meta.ts';

export default function SpriteSplitterTool() {
  const [input, setInput] = useState('');
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fileError, setFileError] = useState<string>();
  const canvas = useRef<HTMLCanvasElement>(null);

  const result = useMemo(
    () =>
      runTool(() => {
        if (input.trim() === '') return '';
        const grid = parseGrid(input);
        const width = image?.naturalWidth ?? grid.width;
        const height = image?.naturalHeight ?? grid.height;
        if (!width || !height) throw new ToolInputError('Add the image width and height, or drop an image.');
        return formatFrames(frameRects(grid.cols, grid.rows, width, height));
      }),
    [input, image],
  );

  const frames = useMemo(() => {
    try {
      if (input.trim() === '') return [];
      const grid = parseGrid(input);
      const width = image?.naturalWidth ?? grid.width;
      const height = image?.naturalHeight ?? grid.height;
      if (!width || !height) return [];
      return frameRects(grid.cols, grid.rows, width, height);
    } catch {
      return [];
    }
  }, [input, image]);

  const shownError = fileError ?? result.error;

  useEffect(() => {
    const el = canvas.current;
    const frame = frames[0];
    if (!el || !image || !frame) return;
    el.width = frame.w;
    el.height = frame.h;
    el.getContext('2d')?.drawImage(image, frame.x, frame.y, frame.w, frame.h, 0, 0, frame.w, frame.h);
  }, [frames, image]);

  const download = async (frame: FrameRect) => {
    if (!image) return;
    const el = document.createElement('canvas');
    el.width = frame.w;
    el.height = frame.h;
    const ctx = el.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(image, frame.x, frame.y, frame.w, frame.h, 0, 0, frame.w, frame.h);
    const blob = await new Promise<Blob | null>((resolve) => el.toBlob(resolve, 'image/png'));
    if (blob) downloadBlob(blob, `frame-${frame.index}.png`);
  };

  return (
    <div class="flex flex-col gap-4">
      <p class="text-sm text-muted">
        Type cols and rows, plus the sheet width and height when you are not dropping a file. Example: 2 2 100 80. A
        dropped image uses its own size.
      </p>
      <FileDropZone
        label="Sprite sheet"
        accept="image/*"
        maxBytes={30 * 1024 * 1024}
        onFiles={(files) => {
          const file = files[0];
          if (!file) return;
          setFileError(undefined);
          void loadImageElement(file).then(
            (loaded) => setImage(loaded),
            () => {
              setImage(null);
              setFileError('Could not read that image.');
            },
          );
        }}
      />
      <TwoPane
        inputLabel="Grid"
        input={input}
        onInput={setInput}
        inputPlaceholder="2 2 100 80"
        outputLabel="Frames"
        output={result.error ? '' : (result.output ?? '')}
        error={shownError}
        examples={meta.examples}
      />
      {image && frames[0] && (
        <canvas ref={canvas} role="img" aria-label="First frame" class="max-w-full rounded-lg border border-border" />
      )}
      {image && frames.length > 0 && (
        <div class="flex flex-wrap gap-2">
          {frames.slice(0, 16).map((frame) => (
            <Button key={frame.index} onClick={() => void download(frame)}>
              {`Frame ${frame.index}`}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
