/**
 * The CSP nonce end to end on the server: a real React Router request handler with our
 * entry.server and the root middleware renders a page. Every <script> in the HTML must carry
 * the nonce the Content-Security-Policy header names; otherwise the browser refuses the
 * hydration scripts and the app never becomes interactive.
 */
import { createElement, type ReactNode } from "react";
import {
  createRequestHandler,
  Outlet,
  Scripts,
  ScrollRestoration,
  type ServerBuild,
} from "react-router";
import { describe, expect, it } from "vitest";

process.env.DATABASE_URL ??= "file::memory:";

async function buildWithRootMiddleware(): Promise<ServerBuild> {
  const entry = await import("~/entry.server");
  const { securityHeadersMiddleware } = await import("~/server/securityHeaders.server");
  const root = {
    middleware: [securityHeadersMiddleware],
    Layout: ({ children }: { children: ReactNode }) =>
      createElement(
        "html",
        null,
        createElement("head", null),
        createElement(
          "body",
          null,
          children,
          createElement(ScrollRestoration),
          createElement(Scripts),
        ),
      ),
    default: () => createElement(Outlet),
  };
  const page = { default: () => createElement("p", null, "Hallo") };
  const entryRoute = {
    hasAction: false,
    hasLoader: false,
    hasClientAction: false,
    hasClientLoader: false,
    hasClientMiddleware: false,
    hasErrorBoundary: false,
    clientActionModule: undefined,
    clientLoaderModule: undefined,
    clientMiddlewareModule: undefined,
    hydrateFallbackModule: undefined,
    imports: [],
  };
  return {
    entry: { module: entry },
    routes: {
      root: { id: "root", path: "", module: root },
      page: { id: "page", parentId: "root", index: true, module: page },
    },
    assets: {
      entry: { module: "/assets/entry.client.js", imports: [] },
      routes: {
        root: { ...entryRoute, id: "root", path: "", module: "/assets/root.js" },
        page: {
          ...entryRoute,
          id: "page",
          parentId: "root",
          index: true,
          module: "/assets/page.js",
        },
      },
      url: "/assets/manifest.js",
      version: "test",
    },
    publicPath: "/",
    assetsBuildDirectory: "build/client",
    future: {},
    ssr: true,
    isSpaMode: false,
    prerender: [],
    routeDiscovery: { mode: "lazy", manifestPath: "/__manifest" },
  } as unknown as ServerBuild;
}

describe("CSP nonce on a rendered page", () => {
  it("gives every script the nonce the CSP header allows", async () => {
    const handler = createRequestHandler(await buildWithRootMiddleware(), "production");
    const response = await handler(new Request("http://localhost/"));
    const html = await response.text();
    const policy = response.headers.get("Content-Security-Policy") ?? "";

    const nonce = /'nonce-([^']+)'/.exec(policy)?.[1];
    expect(nonce).toBeTruthy();
    expect(policy).not.toContain("'unsafe-inline' 'nonce");

    const scripts = html.match(/<script\b[^>]*>/g) ?? [];
    expect(scripts.length).toBeGreaterThan(0);
    for (const tag of scripts) expect(tag).toContain(`nonce="${nonce}"`);
  });

  it("uses a different nonce for every page view", async () => {
    const handler = createRequestHandler(await buildWithRootMiddleware(), "production");
    const nonceOf = async () =>
      /'nonce-([^']+)'/.exec(
        (await handler(new Request("http://localhost/"))).headers.get("Content-Security-Policy") ??
          "",
      )?.[1];
    expect(await nonceOf()).not.toBe(await nonceOf());
  });
});
