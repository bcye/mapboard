import type { Engine } from "engine";
import { useEffect } from "react";

/**
 * Asks the browser to keep this site's storage on the first edit of a session,
 * so boards aren't evicted when the disk runs low. Firefox may prompt, which is
 * why this waits for an edit instead of running on load.
 */
export function usePersistentStorage(engine: Engine) {
  useEffect(() => {
    if (!navigator.storage?.persist) return;
    const stop = engine.state.$history.listen(({ canUndo }) => {
      if (!canUndo) return;
      stop();
      void navigator.storage
        .persisted()
        .then((persisted) => persisted || navigator.storage.persist())
        .catch(() => {
          // Not granted; boards are still saved, just evictable.
        });
    });
    return stop;
  }, [engine]);
}
