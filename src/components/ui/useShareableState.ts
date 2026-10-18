import { useEffect, useRef } from 'preact/hooks';
import { readSharedState } from '../../lib/url-state.ts';

/**
 * Restores state from a share link (#s=...) once after mount. Pair with
 * <ShareButton state={...} />. Never use in sensitive tools (the validator checks).
 */
export function useShareableState<T>(onRestore: (state: T) => void): void {
  const restore = useRef(onRestore);
  restore.current = onRestore;
  useEffect(() => {
    void readSharedState<T>().then((state) => {
      if (state !== undefined) restore.current(state);
    });
  }, []);
}
