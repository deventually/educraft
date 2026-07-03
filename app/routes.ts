import { type RouteConfig, index, route, layout, prefix } from "@react-router/dev/routes";

export default [
  layout("components/AppShell.tsx", [
    index("routes/home.tsx"),
    route("tools/:slug", "routes/tool.tsx"),
    ...prefix("projects", [index("routes/projects._index.tsx")]),
    ...prefix("help", [index("routes/help._index.tsx"), route(":id", "routes/help.$id.tsx")]),
    route("context-profiles", "routes/context-profiles.tsx"),
    route("about", "routes/about.tsx"),
    route("contact", "routes/contact.tsx"),
    route("cookies", "routes/cookies.tsx"),
    route("legal", "routes/legal.tsx"),
  ]),
  // Auth front door — outside the AppShell layout (no nav/footer chrome).
  route("invite/:token", "routes/invite.tsx"),
  route("login", "routes/login.tsx"),
  // Resource route (no UI) — POST destroys the session.
  route("logout", "routes/logout.tsx"),
  // Resource route (no UI) — SSE streaming endpoint for generators.
  route("api/stream", "routes/api.stream.tsx"),
  // Resource route (no UI) — persists the chosen UI locale in a cookie.
  route("set-locale", "routes/set-locale.tsx"),
  // Resource route (no UI) — silences Chrome DevTools' workspace probe.
  route(".well-known/appspecific/com.chrome.devtools.json", "routes/devtools-probe.tsx"),
] satisfies RouteConfig;
