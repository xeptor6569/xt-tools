// Pure rules for the 404 hash snake. The page draws it; nothing here touches the DOM or storage.

export const SNAKE_COLUMNS = 12;
export const SNAKE_ROWS = 12;

export type Direction = 'up' | 'down' | 'left' | 'right';

export interface Cell {
  x: number;
  y: number;
}

export interface SnakeRun {
  width: number;
  height: number;
  /** Head first. */
  snake: Cell[];
  direction: Direction;
  queued: Direction;
  food: Cell;
  foodByte: number;
  eaten: number[];
  over: boolean;
  won: boolean;
}

/** Returns `n` random bytes. The page passes `crypto.getRandomValues`; tests pass a script. */
export type RandomBytes = (n: number) => Uint8Array;

const OPPOSITE: Record<Direction, Direction> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

function startingSnake(width: number, height: number): Cell[] {
  const x = Math.floor(width / 2);
  const y = Math.floor(height / 2);
  return [
    { x, y },
    { x: x - 1, y },
    { x: x - 2, y },
  ];
}

function keyOf(cell: Cell, width: number): number {
  return cell.y * width + cell.x;
}

/** Uniform index in `0 .. count-1` from random bytes, without modulo bias. */
function pickIndex(random: RandomBytes, count: number): number {
  if (count <= 1) return 0;
  const span = 0x10000;
  const limit = span - (span % count);
  for (;;) {
    const bytes = random(2);
    const n = ((bytes[0] ?? 0) << 8) | (bytes[1] ?? 0);
    if (n < limit) return n % count;
  }
}

function placeFood(
  snake: readonly Cell[],
  width: number,
  height: number,
  random: RandomBytes,
): Pick<SnakeRun, 'food' | 'foodByte'> {
  const taken = new Set(snake.map((cell) => keyOf(cell, width)));
  const free: number[] = [];
  for (let i = 0; i < width * height; i++) {
    if (!taken.has(i)) free.push(i);
  }
  const index = free[pickIndex(random, free.length)] ?? 0;
  const byte = random(1)[0] ?? 0;
  return { food: { x: index % width, y: Math.floor(index / width) }, foodByte: byte };
}

export function createRun(random: RandomBytes, width = SNAKE_COLUMNS, height = SNAKE_ROWS): SnakeRun {
  if (width < 4 || height < 2) throw new Error('The board is too small.');
  const snake = startingSnake(width, height);
  return {
    width,
    height,
    snake,
    direction: 'right',
    queued: 'right',
    eaten: [],
    over: false,
    won: false,
    ...placeFood(snake, width, height, random),
  };
}

/** Remembers one turn. A reversal is ignored so the head cannot step back into its neck. */
export function queueDirection(run: SnakeRun, next: Direction): SnakeRun {
  if (run.over || next === OPPOSITE[run.direction]) return run;
  return { ...run, queued: next };
}

function forward(cell: Cell, direction: Direction): Cell {
  if (direction === 'up') return { x: cell.x, y: cell.y - 1 };
  if (direction === 'down') return { x: cell.x, y: cell.y + 1 };
  if (direction === 'left') return { x: cell.x - 1, y: cell.y };
  return { x: cell.x + 1, y: cell.y };
}

function sameCell(a: Cell, b: Cell): boolean {
  return a.x === b.x && a.y === b.y;
}

export function step(run: SnakeRun, random: RandomBytes): SnakeRun {
  if (run.over) return run;
  const direction = run.queued;
  const head = run.snake[0];
  if (!head) return { ...run, over: true };
  const next = forward(head, direction);
  if (next.x < 0 || next.y < 0 || next.x >= run.width || next.y >= run.height) {
    return { ...run, direction, over: true };
  }

  const eating = sameCell(next, run.food);
  const body = eating ? run.snake : run.snake.slice(0, -1);
  if (body.some((cell) => sameCell(cell, next))) return { ...run, direction, over: true };

  const snake = [next, ...(eating ? run.snake : run.snake.slice(0, -1))];
  if (!eating) return { ...run, snake, direction };

  const eaten = [...run.eaten, run.foodByte];
  if (snake.length === run.width * run.height) {
    return { ...run, snake, direction, eaten, over: true, won: true };
  }
  return { ...run, snake, direction, eaten, ...placeFood(snake, run.width, run.height, random) };
}

export function hexByte(byte: number): string {
  return (byte & 0xff).toString(16).padStart(2, '0');
}

/** SHA-256 of the eaten bytes, as lowercase hex. An empty run hashes no bytes. */
export async function fingerprint(bytes: readonly number[]): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes));
  return [...new Uint8Array(digest)].map((byte) => hexByte(byte)).join('');
}

/** First 8 bytes of a hex digest, the score shown on the board. */
export function shortFingerprint(hex: string): string {
  return hex.slice(0, 16);
}
