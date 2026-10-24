import { useEffect, useRef, useState } from 'preact/hooks';
import { errorMessage } from '../../lib/run-tool.ts';

/** Runs a user-triggered lookup. A second run cancels the one before it. */
export function useLookup<T>() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [output, setOutput] = useState<T | undefined>(undefined);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  function run(task: (signal: AbortSignal) => Promise<T>): void {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setPending(true);
    setError(undefined);
    void task(controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setOutput(result);
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return;
        setOutput(undefined);
        setError(errorMessage(caught));
      })
      .finally(() => {
        if (abortRef.current === controller) setPending(false);
      });
  }

  return { pending, error, output, run };
}
