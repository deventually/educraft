import { useEffect, useMemo, useRef } from "react";

/**
 * The model calls a view has running, by key (a stage id; one call needs no key). Starting a
 * call aborts the one it replaces, and closing the view aborts them all: navigating away or
 * closing a part of the page stops the model call on the server, like closing the tab does.
 */
export function useStreamAborts() {
  const running = useRef(new Map<string, AbortController>());

  useEffect(() => {
    const calls = running.current;
    return () => {
      for (const ctrl of calls.values()) ctrl.abort();
      calls.clear();
    };
  }, []);

  return useMemo(
    () => ({
      /** A fresh signal for the call under `key`, aborting the one it replaces. */
      start(key = ""): AbortSignal {
        running.current.get(key)?.abort();
        const ctrl = new AbortController();
        running.current.set(key, ctrl);
        return ctrl.signal;
      },
      /** Stops the call under `key` (the Stop button). */
      abort(key = ""): void {
        running.current.get(key)?.abort();
        running.current.delete(key);
      },
    }),
    [],
  );
}
