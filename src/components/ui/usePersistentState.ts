import { useCallback, useEffect, useLayoutEffect, useState } from 'preact/hooks';
import { readJson, removeKey, writeJson } from '../../lib/storage.ts';

const EVENT = 'xt:remember';

interface RememberDetail {
  toolId: string;
  on: boolean;
}

/**
 * Tool state that the user can choose to remember on this device. Off by
 * default; never use it in tools marked `sensitive` (the validator checks).
 * Every hook with the same `toolId` shares one "remember" switch.
 *
 *   const [input, setInput, remember] = usePersistentState('json-format', 'input', '');
 *   <RememberToggle {...remember} />
 */
export function usePersistentState<T>(toolId: string, key: string, initial: T) {
  const stateKey = `tool:${toolId}:${key}`;
  const flagKey = `tool:${toolId}:remember`;
  const [value, setValue] = useState<T>(initial);
  const [enabled, setEnabledState] = useState(false);

  // Read after mount so server and client render the same first frame.
  useEffect(() => {
    if (readJson<boolean>(flagKey) !== true) return;
    setEnabledState(true);
    const stored = readJson<T>(stateKey);
    if (stored !== undefined) setValue(stored);
  }, [flagKey, stateKey]);

  // Follow the shared switch.
  useEffect(() => {
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<RememberDetail>).detail;
      if (detail.toolId !== toolId) return;
      setEnabledState(detail.on);
      if (!detail.on) removeKey(stateKey);
    };
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, [toolId, stateKey]);

  // Layout effect: written right after the render, not after the next paint,
  // so closing the tab straight after a change doesn't lose it.
  useLayoutEffect(() => {
    if (enabled) writeJson(stateKey, value);
  }, [enabled, stateKey, value]);

  const setEnabled = useCallback(
    (on: boolean) => {
      if (on) writeJson(flagKey, true);
      else removeKey(flagKey);
      window.dispatchEvent(new CustomEvent<RememberDetail>(EVENT, { detail: { toolId, on } }));
    },
    [flagKey, toolId],
  );

  return [value, setValue, { enabled, setEnabled }] as const;
}
