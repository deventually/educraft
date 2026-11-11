import { useEffect, useMemo, useRef } from "react";
import { useAiWork } from "~/components/AiLeaveGuard";

/**
 * The model calls a view has running, by key (a stage id; one call needs no key). Starting a
 * call aborts the one it replaces. While `busy`, leaving the page asks the teacher: "Keep
 * running" lets the calls finish (the server saves the result), "Stop" aborts them. A view
 * that closes any other way aborts its calls, as closing the tab does.
 */
export function useStreamAborts(busy: boolean) {
  const running = useRef(new Map<string, AbortController>());

  useEffect(() => {
    const calls = running.current;
    return () => {
      for (const ctrl of calls.values()) ctrl.abort();
      calls.clear();
    };
  }, []);

  const streams = useMemo(
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

  useAiWork(busy, {
    abort: () => {
      for (const ctrl of running.current.values()) ctrl.abort();
      running.current.clear();
    },
    // Let go of the calls, so closing the view no longer aborts them.
    keep: () => running.current.clear(),
  });

  return streams;
}
