// Setup for the shared projects (`isolate: false`, vitest.config.ts): their files share one module
// graph per worker, so each file starts from a fresh in-memory database and leaves no stubs behind.
import { afterAll, vi } from "vitest";

type Cached = { __limeonitDbs?: Map<string, { $client: { close(): void } }> };
const cache = globalThis as unknown as Cached; // the getDb() cache in app/server/db.server.ts
for (const db of cache.__limeonitDbs?.values() ?? []) db.$client.close();
delete cache.__limeonitDbs;

afterAll(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
