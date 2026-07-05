import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteLoaderData,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";
import { DEFAULT_LOCALE, getMessages, type Locale } from "~/lib/i18n";
import { getLocale } from "~/lib/i18n/locale.server";
import { getUser } from "~/server/auth.server";
import { getEffectiveRole } from "~/server/roleView.server";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=Newsreader:ital,opsz,wght@0,6..72,400..600;1,6..72,400..500&display=swap",
  },
];

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getUser(request);
  return {
    locale: getLocale(request),
    // Only the display-safe fields reach the client (never the password hash).
    // `role` is the *effective* role (an admin may view-as teacher); `realRole`
    // is the account's true role, so the shell can still offer the switch back.
    user: user
      ? { name: user.name, role: getEffectiveRole(user, request), realRole: user.role }
      : null,
  };
}

export function meta({ data }: Route.MetaArgs) {
  const m = getMessages(data?.locale);
  return [{ title: m.meta.homeTitle }, { name: "description", content: m.meta.description }];
}

export function Layout({ children }: { children: React.ReactNode }) {
  const data = useRouteLoaderData<typeof loader>("root");
  const locale: Locale = data?.locale ?? DEFAULT_LOCALE;
  return (
    <html lang={locale}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const data = useRouteLoaderData<typeof loader>("root");
  const m = getMessages(data?.locale);
  let message = m.error.title;
  let details = m.error.generic;
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? m.error.notFoundTitle : m.error.serverErrorTitle;
    details = error.status === 404 ? m.error.notFound : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
