// Minimal request/response RPC between a tool UI and its Web Worker.
// Errors keep their `name`, so a ToolInputError thrown in the worker is shown
// to the user like one thrown on the main thread.
import { ToolInputError } from '../tools/types.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handler = (...args: any[]) => unknown;

interface Request {
  id: number;
  method: string;
  args: unknown[];
}

type Response = { id: number; ok: true; value: unknown } | { id: number; ok: false; name: string; message: string };

/** Call inside worker.ts to make functions callable from the UI. */
export function expose(handlers: Record<string, Handler>): void {
  const scope = globalThis as unknown as {
    addEventListener: (type: 'message', listener: (event: MessageEvent<Request>) => void) => void;
    postMessage: (message: Response) => void;
  };
  scope.addEventListener('message', (event) => {
    const { id, method, args } = event.data;
    const handler = handlers[method];
    Promise.resolve()
      .then(() => {
        if (!handler) throw new Error(`Unknown worker method "${method}"`);
        return handler(...args);
      })
      .then(
        (value) => scope.postMessage({ id, ok: true, value }),
        (error: unknown) => {
          const e = error instanceof Error ? error : new Error(String(error));
          scope.postMessage({ id, ok: false, name: e.name, message: e.message });
        },
      );
  });
}

export interface WorkerClient {
  call<T>(method: string, ...args: unknown[]): Promise<T>;
  terminate(): void;
}

/** Wraps a Worker created with `new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })`. */
export function connect(worker: Worker): WorkerClient {
  let nextId = 0;
  const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

  worker.addEventListener('message', (event: MessageEvent<Response>) => {
    const res = event.data;
    const entry = pending.get(res.id);
    if (!entry) return;
    pending.delete(res.id);
    if (res.ok) entry.resolve(res.value);
    else {
      const error = res.name === 'ToolInputError' ? new ToolInputError(res.message) : new Error(res.message);
      if (res.name !== 'ToolInputError') error.name = res.name;
      entry.reject(error);
    }
  });

  return {
    call<T>(method: string, ...args: unknown[]) {
      const id = nextId++;
      return new Promise<T>((resolve, reject) => {
        pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
        worker.postMessage({ id, method, args } satisfies Request);
      });
    },
    terminate() {
      worker.terminate();
      for (const entry of pending.values()) entry.reject(new Error('Worker terminated'));
      pending.clear();
    },
  };
}
