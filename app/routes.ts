import { type RouteConfig, index, route, layout, prefix } from "@react-router/dev/routes";

export default [
  layout("components/AppShell.tsx", [
    // `/` is a role-aware redirector (admin → /admin/users, else → /tools).
    index("routes/index.tsx"),
    // The tool catalogue lives at /tools (home.tsx); individual tools at /tools/:slug.
    route("tools", "routes/home.tsx"),
    route("tools/:slug", "routes/tool.tsx"),
    ...prefix("projects", [index("routes/projects._index.tsx")]),
    // BDB/BKE workplace (brief P25, 25.3): dossier list, overview, framework, one outcome.
    ...prefix("portfolio", [
      index("routes/portfolio._index.tsx"),
      route(":id", "routes/portfolio.$id.tsx"),
      route(":id/framework", "routes/portfolio.$id.framework.tsx"),
      route(":id/outcome/:outcomeId", "routes/portfolio.$id.outcome.$outcomeId.tsx"),
    ]),
    ...prefix("help", [index("routes/help._index.tsx"), route(":id", "routes/help.$id.tsx")]),
    route("context-profiles", "routes/context-profiles.tsx"),
    route("account", "routes/account.tsx"),
    // Admin console (Phase 4, four pages since P18.4). The layout gates on requireRole("admin"); every
    // child repeats the check (loaders run in parallel).
    route("admin", "routes/admin.tsx", [
      index("routes/admin._index.tsx"), // redirects to /admin/users
      route("users", "routes/admin.users.tsx"),
      route("tools", "routes/admin.tools.tsx"),
      route("context", "routes/admin.context.tsx"),
      route("usage", "routes/admin.usage.tsx"),
    ]),
    route("about", "routes/about.tsx"),
    route("cookies", "routes/cookies.tsx"),
    route("legal", "routes/legal.tsx"),
  ]),
  // Auth front door — outside the AppShell layout (no nav/footer chrome).
  route("invite/:token", "routes/invite.tsx"),
  route("reset/:token", "routes/reset.$token.tsx"),
  route("login", "routes/login.tsx"),
  // Resource route (no UI) — POST destroys the session.
  route("logout", "routes/logout.tsx"),
  // Resource route (no UI) — SSE streaming endpoint for generators.
  route("api/stream", "routes/api.stream.tsx"),
  // Resource route (no UI) — records tester feedback on a generation.
  route("api/feedback", "routes/api.feedback.tsx"),
  // Public health probe for orchestrators (no auth, no chrome).
  route("healthz", "routes/healthz.tsx"),
  // Resource route (no UI) — persists the chosen UI locale in a cookie.
  route("set-locale", "routes/set-locale.tsx"),
  // Resource route (no UI) — silences Chrome DevTools' workspace probe.
  route(".well-known/appspecific/com.chrome.devtools.json", "routes/devtools-probe.tsx"),
] satisfies RouteConfig;
