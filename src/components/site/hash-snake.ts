// Drawn only after the 404 page asks for it. Kept out of the tool-page bundles.
import { copyText } from '../../lib/clipboard.ts';
import {
  createRun,
  fingerprint,
  hexByte,
  queueDirection,
  shortFingerprint,
  step,
  type Direction,
  type SnakeRun,
} from '../../lib/hash-snake.ts';

const TICK_MS = 150;

const KEYS: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  a: 'left',
  s: 'down',
  d: 'right',
  W: 'up',
  A: 'left',
  S: 'down',
  D: 'right',
};

function randomBytes(n: number): Uint8Array {
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  return bytes;
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const buttonClass =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-fg hover:border-accent';

export function mountHashSnake(root: Element): void {
  root.replaceChildren();

  const score = element('p', 'text-sm text-muted', '0 bytes');
  const board = element('div', 'grid w-full max-w-xs grid-cols-12 gap-px rounded-md');
  board.tabIndex = 0;
  board.setAttribute('role', 'group');
  board.setAttribute('aria-label', 'Hash snake. Arrow keys move.');
  board.dataset.xt = 'hash-snake-board';

  const cells: HTMLElement[] = [];
  const grid = element('div', 'contents');
  grid.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 12 * 12; i++) {
    const cell = element(
      'span',
      'flex aspect-square items-center justify-center rounded-sm bg-surface font-mono text-[10px]',
    );
    cell.setAttribute('aria-hidden', 'true');
    cells.push(cell);
    grid.append(cell);
  }
  board.append(grid);

  const controls = element('div', 'flex flex-wrap gap-2');
  controls.setAttribute('role', 'group');
  controls.setAttribute('aria-label', 'Direction');
  const directions: Array<[Direction, string]> = [
    ['up', 'Up'],
    ['left', 'Left'],
    ['down', 'Down'],
    ['right', 'Right'],
  ];
  for (const [direction, label] of directions) {
    const button = element('button', buttonClass, label);
    button.type = 'button';
    button.addEventListener('click', () => {
      run = queueDirection(run, direction);
      board.focus();
    });
    controls.append(button);
  }

  const hint = element('p', 'text-sm text-muted', 'Arrow keys, W A S D, or the buttons. Nothing is saved.');
  const result = element('div', 'flex flex-col gap-2');
  result.hidden = true;
  const outcome = element('p', 'text-sm');
  const digest = element('p', 'font-mono text-lg tracking-wide');
  digest.dataset.xt = 'hash-snake-score';
  const full = element('code', 'font-mono text-xs break-all text-muted');
  full.dataset.xt = 'hash-snake-fingerprint';
  const copy = element('button', buttonClass, 'Copy SHA-256');
  copy.type = 'button';
  const again = element('button', buttonClass, 'Play again');
  again.type = 'button';
  const actions = element('div', 'flex flex-wrap gap-2');
  actions.append(copy, again);
  result.append(outcome, digest, full, actions);

  const live = element('p', 'sr-only');
  live.setAttribute('role', 'status');

  root.append(score, board, controls, hint, result, live);

  let run = createRun(randomBytes);
  let timer = 0;
  let generation = 0;
  let copying = false;

  const paint = () => {
    const head = run.snake[0];
    const occupied = new Map<string, 'head' | 'body'>();
    run.snake.forEach((cell, index) => occupied.set(`${cell.x},${cell.y}`, index === 0 ? 'head' : 'body'));
    cells.forEach((cell, index) => {
      const x = index % 12;
      const y = Math.floor(index / 12);
      const kind = occupied.get(`${x},${y}`);
      const foodHere = !run.over && run.food.x === x && run.food.y === y;
      cell.textContent = foodHere ? hexByte(run.foodByte) : '';
      cell.className = foodHere
        ? 'flex aspect-square items-center justify-center rounded-sm bg-warning-bg font-mono text-[10px] text-warning'
        : kind === 'head'
          ? 'flex aspect-square items-center justify-center rounded-sm bg-accent font-mono text-[10px]'
          : kind === 'body'
            ? 'flex aspect-square items-center justify-center rounded-sm bg-accent/40 font-mono text-[10px]'
            : 'flex aspect-square items-center justify-center rounded-sm bg-surface font-mono text-[10px]';
    });
    const count = run.eaten.length;
    score.textContent = head
      ? `${count} ${count === 1 ? 'byte' : 'bytes'}${run.over ? '' : ` · next ${hexByte(run.foodByte)}`}`
      : '0 bytes';
  };

  const finish = (hash: string, seen: number) => {
    if (seen !== generation) return;
    window.clearInterval(timer);
    const count = run.eaten.length;
    const ending = run.won ? 'The board is full' : 'Crashed';
    outcome.textContent = `${ending} after ${count} ${count === 1 ? 'byte' : 'bytes'}.`;
    digest.textContent = shortFingerprint(hash);
    full.textContent = hash;
    result.hidden = false;
    live.textContent = `${outcome.textContent} SHA-256 ${shortFingerprint(hash)}.`;
    paint();
  };

  const tick = () => {
    if (run.over) return;
    const seen = generation;
    const before = run.eaten.length;
    run = step(run, randomBytes);
    if (run.over) {
      void fingerprint(run.eaten).then((hash) => finish(hash, seen));
      return;
    }
    if (run.eaten.length !== before)
      live.textContent = `Ate ${hexByte(run.eaten.at(-1) ?? 0)}. ${run.eaten.length} bytes.`;
    paint();
  };

  const start = (next: SnakeRun) => {
    generation += 1;
    window.clearInterval(timer);
    run = next;
    result.hidden = true;
    live.textContent = 'The snake is moving.';
    paint();
    board.focus();
    timer = window.setInterval(tick, TICK_MS);
  };

  board.addEventListener('keydown', (event) => {
    const direction = KEYS[event.key];
    if (!direction) return;
    event.preventDefault();
    run = queueDirection(run, direction);
  });

  copy.addEventListener('click', async () => {
    if (copying) return;
    copying = true;
    const ok = await copyText(full.textContent ?? '');
    copy.textContent = ok ? 'Copied' : 'Copy failed';
    window.setTimeout(() => {
      copy.textContent = 'Copy SHA-256';
      copying = false;
    }, 2000);
  });

  again.addEventListener('click', () => start(createRun(randomBytes)));

  start(run);
}
