/**
 * What a page looked like in one browser history entry, so Back and Forward can bring it back
 * (a tool's input and result). It lives in this tab's sessionStorage only: never on the
 * server, gone when the tab closes. Only the latest entries are kept.
 */
const PREFIX = "limeonit:entry:";
const INDEX = "limeonit:entries";
const KEEP = 30;

function sessionStore(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.sessionStorage;
  } catch {
    return undefined;
  }
}

function readIndex(storage: Storage): string[] {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(INDEX) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === "string") : [];
  } catch {
    return [];
  }
}

/** The saved state under `key`, unparsed (the caller validates it); null when there is none. */
export function readEntry(key: string, storage = sessionStore()): unknown {
  if (!storage) return null;
  try {
    const raw = storage.getItem(PREFIX + key);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Save `json` (already serialised) under `key`. The oldest entries make room, and when the
 * browser is full every other entry goes before giving up. False when it could not be saved.
 */
export function writeEntry(key: string, json: string, storage = sessionStore()): boolean {
  if (!storage) return false;
  const index = [...readIndex(storage).filter((k) => k !== key), key];
  const drop = (keys: string[]) => {
    for (const k of keys) storage.removeItem(PREFIX + k);
  };
  const save = (keys: string[]) => {
    storage.setItem(PREFIX + key, json);
    storage.setItem(INDEX, JSON.stringify(keys));
  };
  try {
    drop(index.slice(0, -KEEP));
    save(index.slice(-KEEP));
    return true;
  } catch {
    try {
      drop(index.slice(0, -1));
      save([key]);
      return true;
    } catch {
      return false;
    }
  }
}
