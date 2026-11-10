// Setup for the shared projects (`isolate: false`, vitest.config.ts): their files share one module
// graph per worker, so each file starts from a fresh in-memory database and leaves no stubs behind.
import { afterAll, vi } from "vitest";

type Cached = { __limeonitDb?: { $client: { close(): void } } };
const cache = globalThis as unknown as Cached; // the getDb() cache in app/server/db.server.ts
cache.__limeonitDb?.$client.close();
delete cache.__limeonitDb;

afterAll(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
