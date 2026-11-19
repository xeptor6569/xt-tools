import { describe, expect, it } from 'vitest';
import {
  createRun,
  fingerprint,
  queueDirection,
  shortFingerprint,
  step,
  type RandomBytes,
  type SnakeRun,
} from './hash-snake.ts';

function scripted(bytes: number[]): RandomBytes {
  let i = 0;
  return (n) => {
    const out = new Uint8Array(n);
    for (let j = 0; j < n; j++) out[j] = bytes[i++] ?? 0;
    return out;
  };
}

function runAt(partial: Partial<SnakeRun> & Pick<SnakeRun, 'snake' | 'direction'>): SnakeRun {
  return {
    width: 12,
    height: 12,
    queued: partial.direction,
    food: { x: 11, y: 11 },
    foodByte: 0,
    eaten: [],
    over: false,
    won: false,
    ...partial,
  };
}

describe('hash snake', () => {
  it('starts clear of its food and facing right', () => {
    const run = createRun(scripted([0, 0, 0xab]));
    expect(run.direction).toBe('right');
    expect(run.snake).toHaveLength(3);
    expect(run.snake.some((cell) => cell.x === run.food.x && cell.y === run.food.y)).toBe(false);
    expect(run.food).toEqual({ x: 0, y: 0 });
    expect(run.foodByte).toBe(0xab);
  });

  it('moves forward and refuses to reverse into its neck', () => {
    const start = runAt({
      snake: [
        { x: 4, y: 4 },
        { x: 3, y: 4 },
        { x: 2, y: 4 },
      ],
      direction: 'right',
    });
    const reversed = step(queueDirection(start, 'left'), scripted([]));
    expect(reversed.over).toBe(false);
    expect(reversed.snake[0]).toEqual({ x: 5, y: 4 });
    expect(reversed.snake).toHaveLength(3);

    const turned = step(queueDirection(start, 'up'), scripted([]));
    expect(turned.snake[0]).toEqual({ x: 4, y: 3 });
    expect(turned.snake[2]).toEqual({ x: 3, y: 4 });
  });

  it('grows by the byte it eats', () => {
    const start = runAt({
      snake: [
        { x: 4, y: 4 },
        { x: 3, y: 4 },
        { x: 2, y: 4 },
      ],
      direction: 'right',
      food: { x: 5, y: 4 },
      foodByte: 0x3c,
    });
    const eaten = step(start, scripted([0, 1, 0x10]));
    expect(eaten.eaten).toEqual([0x3c]);
    expect(eaten.snake).toHaveLength(4);
    expect(eaten.snake[0]).toEqual({ x: 5, y: 4 });
    expect(eaten.foodByte).toBe(0x10);
    expect(eaten.over).toBe(false);
  });

  it('may move into the cell the tail just left', () => {
    const start = runAt({
      snake: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
      ],
      direction: 'down',
      queued: 'down',
    });
    const next = step(start, scripted([]));
    expect(next.over).toBe(false);
    expect(next.snake[0]).toEqual({ x: 0, y: 1 });
  });

  it('ends on a wall or its own body', () => {
    const wall = step(
      runAt({
        snake: [
          { x: 11, y: 1 },
          { x: 10, y: 1 },
          { x: 9, y: 1 },
        ],
        direction: 'right',
      }),
      scripted([]),
    );
    expect(wall.over).toBe(true);
    expect(wall.won).toBe(false);

    const self = step(
      runAt({
        snake: [
          { x: 2, y: 2 },
          { x: 1, y: 2 },
          { x: 0, y: 2 },
          { x: 0, y: 1 },
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 2, y: 0 },
          { x: 2, y: 1 },
        ],
        direction: 'up',
        queued: 'left',
      }),
      scripted([]),
    );
    expect(self.over).toBe(true);
    expect(self.snake[0]).toEqual({ x: 2, y: 2 });
  });

  it('wins when the last empty cell is eaten', () => {
    const full = step(
      runAt({
        width: 2,
        height: 2,
        snake: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: 1 },
        ],
        direction: 'down',
        queued: 'down',
        food: { x: 0, y: 1 },
        foodByte: 0xff,
      }),
      scripted([]),
    );
    expect(full.won).toBe(true);
    expect(full.over).toBe(true);
    expect(full.eaten).toEqual([0xff]);
    expect(full.snake).toHaveLength(4);
  });

  it('hashes the eaten bytes and shows the first 8 as the score', async () => {
    const empty = await fingerprint([]);
    expect(empty).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(shortFingerprint(empty)).toBe('e3b0c44298fc1c14');
    const one = await fingerprint([0x00]);
    expect(one).toHaveLength(64);
    expect(one).not.toBe(empty);
  });
});
