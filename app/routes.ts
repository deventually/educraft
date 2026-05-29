import { type RouteConfig, index, route, layout, prefix } from "@react-router/dev/routes";

export default [
  layout("components/AppShell.tsx", [
    index("routes/home.tsx"),
    route("tools/:slug", "routes/tool.tsx"),
    ...prefix("projects", [index("routes/projects._index.tsx")]),
    route("settings", "routes/settings.tsx"),
    route("about", "routes/about.tsx"),
  ]),
  // Resource route (no UI) — SSE streaming endpoint for generators.
  route("api/stream", "routes/api.stream.tsx"),
  // Resource route (no UI) — persists the chosen UI locale in a cookie.
  route("set-locale", "routes/set-locale.tsx"),
] satisfies RouteConfig;
