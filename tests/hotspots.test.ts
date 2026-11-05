import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { messages } from "~/lib/i18n";
import { flatRoutes } from "./helpers/routes";

/**
 * Merge-conflict hotspots are split per area, so PRs that work on different parts of the app
 * edit different files. See docs/fabriek/besluiten.md (2026-11-04).
 */
const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf8");

describe("i18n messages: one file per namespace", () => {
  const namespaces = Object.entries(messages.nl)
    .filter(([, v]) => typeof v === "object")
    .map(([k]) => k);

  it("has no monolithic nl.ts / en.ts any more", () => {
    expect(existsSync(resolve(root, "app/lib/i18n/messages/nl.ts"))).toBe(false);
    expect(existsSync(resolve(root, "app/lib/i18n/messages/en.ts"))).toBe(false);
  });

  it.each(["nl", "en"])("every namespace has its own file in %s/", (locale) => {
    for (const ns of namespaces) {
      expect(existsSync(resolve(root, `app/lib/i18n/messages/${locale}/${ns}.ts`)), ns).toBe(true);
    }
  });

  it.each(["nl", "en"])("%s/ holds no stray files", (locale) => {
    const files = readdirSync(resolve(root, `app/lib/i18n/messages/${locale}`)).sort();
    expect(files).toEqual(["index.ts", ...namespaces.map((n) => `${n}.ts`)].sort());
  });
});

describe("i18n messages: keys in a fixed (sorted) order", () => {
  // Two PRs in the same namespace used to append at the same spot (the end of an object) and
  // collide. With sorted keys each new key has one fixed place, so inserts rarely touch the same
  // lines. `npm run check` (biome useSortedKeys on app/lib/i18n/messages) sorts and enforces it.
  const unsorted = (obj: unknown, path: string): string[] => {
    if (obj === null || typeof obj !== "object") return [];
    const keys = Object.keys(obj);
    // Biome's natural order: case-insensitive first, then by code point.
    const sorted = [...keys].sort((a, b) => {
      const [x, y] = [a.toLowerCase(), b.toLowerCase()];
      return x < y ? -1 : x > y ? 1 : a < b ? -1 : a > b ? 1 : 0;
    });
    const here = keys.join() === sorted.join() ? [] : [path || "(root)"];
    return [
      ...here,
      ...Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
        unsorted(v, path ? `${path}.${k}` : k),
      ),
    ];
  };

  it.each(["nl", "en"] as const)("every object in %s has sorted keys", (locale) => {
    expect(unsorted(messages[locale], "")).toEqual([]);
  });

  it("biome enforces the order on the message files", () => {
    expect(read("biome.json")).toContain('"useSortedKeys": "on"');
  });
});

describe("routes: one file per area", () => {
  const areas = readdirSync(resolve(root, "app/routing")).filter(
    (f) => f.endsWith(".ts") && f !== "types.ts",
  );

  it("routes.ts registers no routes of its own beyond the shell and its index", () => {
    const src = read("app/routes.ts");
    expect(src.match(/\broute\(/g) ?? []).toEqual([]);
    expect(src.match(/\bprefix\(/g) ?? []).toEqual([]);
  });

  it("routes.ts includes every area file", () => {
    const src = read("app/routes.ts");
    for (const f of areas) expect(src, f).toContain(`./routing/${f.replace(/\.ts$/, "")}"`);
  });

  it("keeps the full route table", () => {
    expect(flatRoutes()).toEqual(
      expect.arrayContaining([
        { path: "/", file: "routes/index.tsx", inShell: true },
        { path: "/tools", file: "routes/home.tsx", inShell: true },
        { path: "/tools/:slug", file: "routes/tool.tsx", inShell: true },
        { path: "/utilities", file: "routes/utilities._index.tsx", inShell: true },
        { path: "/utilities/rubric", file: "routes/utilities.rubric._index.tsx", inShell: true },
        { path: "/utilities/rubric/:id", file: "routes/utilities.rubric.$id.tsx", inShell: true },
        { path: "/utilities/:slug", file: "routes/utilities.$slug.tsx", inShell: true },
        { path: "/projects", file: "routes/projects._index.tsx", inShell: true },
        { path: "/portfolio", file: "routes/portfolio._index.tsx", inShell: true },
        { path: "/portfolio/:id", file: "routes/portfolio.$id.tsx", inShell: true },
        {
          path: "/portfolio/:id/framework",
          file: "routes/portfolio.$id.framework.tsx",
          inShell: true,
        },
        {
          path: "/portfolio/:id/outcome/:outcomeId",
          file: "routes/portfolio.$id.outcome.$outcomeId.tsx",
          inShell: true,
        },
        { path: "/help", file: "routes/help._index.tsx", inShell: true },
        { path: "/help/:id", file: "routes/help.$id.tsx", inShell: true },
        { path: "/context-profiles", file: "routes/context-profiles.tsx", inShell: true },
        { path: "/account", file: "routes/account.tsx", inShell: true },
        { path: "/admin", file: "routes/admin.tsx", inShell: true },
        { path: "/admin", file: "routes/admin._index.tsx", inShell: true },
        { path: "/admin/users", file: "routes/admin.users.tsx", inShell: true },
        { path: "/admin/users/:id", file: "routes/admin.users.$id.tsx", inShell: true },
        { path: "/admin/tools", file: "routes/admin.tools.tsx", inShell: true },
        { path: "/admin/context", file: "routes/admin.context.tsx", inShell: true },
        { path: "/admin/usage", file: "routes/admin.usage.tsx", inShell: true },
        { path: "/about", file: "routes/about.tsx", inShell: true },
        { path: "/cookies", file: "routes/cookies.tsx", inShell: true },
        { path: "/legal", file: "routes/legal.tsx", inShell: true },
        { path: "/invite/:token", file: "routes/invite.tsx", inShell: false },
        { path: "/reset/:token", file: "routes/reset.$token.tsx", inShell: false },
        { path: "/login", file: "routes/login.tsx", inShell: false },
        { path: "/logout", file: "routes/logout.tsx", inShell: false },
        { path: "/api/stream", file: "routes/api.stream.tsx", inShell: false },
        { path: "/portfolio/:id/export", file: "routes/portfolio.$id.export.tsx", inShell: false },
        { path: "/api/feedback", file: "routes/api.feedback.tsx", inShell: false },
        { path: "/healthz", file: "routes/healthz.tsx", inShell: false },
        { path: "/set-locale", file: "routes/set-locale.tsx", inShell: false },
        {
          path: "/.well-known/appspecific/com.chrome.devtools.json",
          file: "routes/devtools-probe.tsx",
          inShell: false,
        },
      ]),
    );
  });

  it("every registered route file exists", () => {
    for (const r of flatRoutes())
      expect(existsSync(resolve(root, "app", r.file)), r.file).toBe(true);
  });
});
