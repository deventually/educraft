import { useEffect, useRef, useState } from "react";
import type { z } from "zod";
import { readEntry, writeEntry } from "~/lib/history/entryMemory";

/**
 * Keeps a view's state for one browser history entry (`key`), so Back and Forward bring the
 * input and the result back (`entryMemory`). On mount the saved state, when it passes
 * `schema`, goes to `restore`; after that every change of `snapshot` is saved. Without a
 * key it does nothing. Restoring happens after mount, so the server render and hydration
 * agree.
 */
export function useEntryMemory<T>(
  key: string | undefined,
  schema: z.ZodType<T>,
  snapshot: T,
  restore: (saved: T) => void,
): void {
  const [ready, setReady] = useState(false);
  // The latest schema and restore, read once per entry: the caller need not keep them stable.
  const latest = useRef({ schema, restore });
  latest.current = { schema, restore };

  useEffect(() => {
    if (!key) return;
    const saved = latest.current.schema.safeParse(readEntry(key));
    if (saved.success) latest.current.restore(saved.data);
    setReady(true);
  }, [key]);

  const json = key && ready ? JSON.stringify(snapshot) : null;
  useEffect(() => {
    if (key && json !== null) writeEntry(key, json);
  }, [key, json]);
}
