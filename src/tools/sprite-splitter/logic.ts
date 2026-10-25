import { ToolInputError } from '../types.ts';

const MAX_INPUT = 10_000;

export interface FrameRect {
  index: number;
  col: number;
  row: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SpriteGrid {
  cols: number;
  rows: number;
  width?: number;
  height?: number;
}

/** Evenly splits `width`×`height` into `cols`×`rows` frames that cover the image. */
export function frameRects(cols: number, rows: number, width: number, height: number): FrameRect[] {
  if (cols < 1 || rows < 1 || width < 1 || height < 1) {
    throw new ToolInputError('Columns, rows, width and height must be at least 1.');
  }
  const frames: FrameRect[] = [];
  for (let row = 0; row < rows; row++) {
    const y = Math.floor((row * height) / rows);
    const y2 = Math.floor(((row + 1) * height) / rows);
    for (let col = 0; col < cols; col++) {
      const x = Math.floor((col * width) / cols);
      const x2 = Math.floor(((col + 1) * width) / cols);
      frames.push({ index: frames.length, col, row, x, y, w: x2 - x, h: y2 - y });
    }
  }
  return frames;
}

export function formatFrames(frames: readonly FrameRect[]): string {
  return frames.map((frame) => `frame ${frame.index}: ${frame.x},${frame.y} ${frame.w}×${frame.h}`).join('\n');
}

/**
 * `cols rows width height`, or `cols rows` (the UI supplies the image size).
 * Example: `2 2 100 80`.
 */
export function spriteSplitter(input: string): string {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large.');
  if (input.trim() === '') return '';
  const grid = parseGrid(input);
  if (grid.width === undefined || grid.height === undefined) {
    throw new ToolInputError('Add the image width and height, or drop an image.');
  }
  return formatFrames(frameRects(grid.cols, grid.rows, grid.width, grid.height));
}

export function parseGrid(input: string): SpriteGrid {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large.');
  const tokens = input.trim().split(/\s+/).filter(Boolean);
  if (tokens.length !== 2 && tokens.length !== 4) {
    throw new ToolInputError('Use "cols rows" or "cols rows width height".');
  }
  const cols = whole(tokens[0] ?? '', 'Columns', 64);
  const rows = whole(tokens[1] ?? '', 'Rows', 64);
  if (tokens.length === 2) return { cols, rows };
  return {
    cols,
    rows,
    width: whole(tokens[2] ?? '', 'Width', 16384),
    height: whole(tokens[3] ?? '', 'Height', 16384),
  };
}

function whole(token: string, label: string, max: number): number {
  if (!/^\d+$/.test(token)) throw new ToolInputError(`${label} must be a whole number.`);
  const value = Number(token);
  if (!Number.isSafeInteger(value) || value < 1 || value > max) {
    throw new ToolInputError(`${label} must be from 1 to ${max}.`);
  }
  return value;
}
