import type { RouteConfigEntry } from "@react-router/dev/routes";
import routes from "~/routes";

export type FlatRoute = { path: string; file: string; inShell: boolean };

/** Flatten the evaluated route config into full paths + files (layouts and index routes included). */
export function flatRoutes(): FlatRoute[] {
  const out: FlatRoute[] = [];
  const walk = (entries: RouteConfigEntry[], base: string, inShell: boolean) => {
    for (const e of entries) {
      const path = e.path ? [base, e.path].filter(Boolean).join("/") : base;
      const isShell = e.file === "components/AppShell.tsx";
      if (!isShell) out.push({ path: `/${path}`, file: e.file, inShell });
      if (e.children) walk(e.children, path, inShell || isShell);
    }
  };
  walk(routes, "", false);
  return out;
}
