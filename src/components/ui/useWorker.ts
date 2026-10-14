import { useCallback, useEffect, useRef } from 'preact/hooks';
import { connect, type WorkerClient } from '../../lib/worker-rpc.ts';
import { ToolInputError } from '../../tools/types.ts';

interface Options {
  /** Stop and restart the worker when a call takes longer than this. */
  timeoutMs?: number;
}

/**
 * Runs calls on a Web Worker. A call that exceeds the timeout terminates the
 * worker (protecting against runaway input such as catastrophic regexes) and
 * rejects with a ToolInputError; the next call starts a fresh worker.
 */
export function useWorker(create: () => Worker, { timeoutMs = 10_000 }: Options = {}) {
  const client = useRef<WorkerClient | null>(null);
  const createRef = useRef(create);
  createRef.current = create;

  useEffect(
    () => () => {
      client.current?.terminate();
      client.current = null;
    },
    [],
  );

  return useCallback(
    <T>(method: string, ...args: unknown[]): Promise<T> => {
      client.current ??= connect(createRef.current());
      const active = client.current;
      return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => {
          active.terminate();
          if (client.current === active) client.current = null;
          reject(new ToolInputError(`Stopped after ${Math.round(timeoutMs / 1000)} seconds. Try a smaller input.`));
        }, timeoutMs);
        active.call<T>(method, ...args).then(
          (value) => {
            clearTimeout(timer);
            resolve(value);
          },
          (error: unknown) => {
            clearTimeout(timer);
            reject(error instanceof Error ? error : new Error(String(error)));
          },
        );
      });
    },
    [timeoutMs],
  );
}
