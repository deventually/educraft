import type { Messages } from "~/lib/i18n";

/**
 * The menu as data (plan "eenvoudiger beheer en navigatie"): the header, the mobile menu and
 * the admin sidebar all read these lists, so they cannot drift apart. A new page in a menu is
 * a new line here, never a new branch in a component. The menu only hides; every page checks
 * access on the server.
 */

/** One link: where it goes, what it is called, and optionally a line that says what it is. */
export type MenuLink = { to: string; label: string; description?: string; end?: boolean };

/** A run of links under an optional heading ("Mensen", "AI", …). */
export type MenuGroup = { heading?: string; links: MenuLink[] };

/** A top-level item: a plain link, or a submenu that opens on a click. */
export type MenuEntry =
  | { kind: "link"; id: string; label: string; link: MenuLink }
  | { kind: "menu"; id: string; label: string; groups: MenuGroup[] };

type Viewer = { role: string; courses: boolean; portfolio: boolean };

/** The admin console, grouped. Also the Beheer submenu of the main menu. */
export function adminMenu(t: Messages, { isOwner }: { isOwner: boolean }): MenuGroup[] {
  const nav = t.admin.console.nav;
  const m = t.menu.admin;
  return [
    { links: [{ to: "/admin", label: m.overview, description: m.overviewDescription, end: true }] },
    {
      heading: m.groups.people,
      links: [
        { to: "/admin/users", label: nav.users, description: m.users },
        { to: "/admin/teams", label: nav.teams, description: m.teams },
      ],
    },
    {
      heading: m.groups.organisation,
      links: [
        {
          to: "/admin/organisation",
          label: m.organisation,
          description: m.organisationDescription,
        },
        { to: "/admin/context", label: m.context, description: m.contextDescription },
      ],
    },
    {
      heading: m.groups.ai,
      links: [
        { to: "/admin/tools", label: nav.tools, description: m.tools },
        { to: "/admin/agents", label: nav.agents, description: m.agents },
        { to: "/usage", label: nav.aiUsage, description: m.aiUsage },
      ],
    },
    {
      heading: m.groups.control,
      links: [
        { to: "/admin/announcements", label: nav.announcements, description: m.announcements },
        { to: "/admin/usage", label: nav.usage, description: m.feedback },
        { to: "/admin/audit", label: nav.audit, description: m.audit },
        ...(isOwner
          ? [{ to: "/admin/errors", label: t.adminErrors.nav, description: m.errors }]
          : []),
      ],
    },
  ];
}

/** Start · Onderwijs · BDB/BKE · Tools, with Beheer first for an admin. */
export function mainMenu(t: Messages, v: Viewer): MenuEntry[] {
  const e = t.menu.education;
  const tools = t.menu.tools;
  const entries: (MenuEntry | false)[] = [
    v.role === "admin" && {
      kind: "menu",
      id: "admin",
      label: t.nav.admin,
      // The header does not know who the owner is; "Recente fouten" stays in the sidebar.
      groups: adminMenu(t, { isOwner: false }),
    },
    {
      kind: "link",
      id: "start",
      label: t.nav.start,
      link: { to: "/start", label: t.nav.start, end: true },
    },
    v.courses && {
      kind: "menu",
      id: "education",
      label: e.label,
      groups: [
        {
          links: [
            { to: "/courses", label: t.nav.courses, description: e.courses },
            { to: "/programmes", label: e.programmes, description: e.programmesDescription },
          ],
        },
      ],
    },
    v.portfolio && {
      kind: "link",
      id: "portfolio",
      label: t.nav.portfolio,
      link: { to: "/portfolio", label: t.nav.portfolio },
    },
    {
      kind: "menu",
      id: "tools",
      label: t.nav.tools,
      groups: [
        {
          links: [
            { to: "/tools", label: tools.all },
            { to: "/utilities", label: tools.utilities },
            { to: "/assessment-models", label: tools.assessmentModels },
            { to: "/projects", label: tools.projects },
          ],
        },
      ],
    },
  ];
  return entries.filter((entry): entry is MenuEntry => entry !== false);
}

/** The personal pages behind the user's name. */
export function accountMenu(t: Messages): MenuLink[] {
  return [
    { to: "/account", label: t.auth.accountArea, end: true },
    { to: "/context-profiles", label: t.menu.account.context },
    { to: "/usage", label: t.menu.account.usage, end: true },
  ];
}

/** Whether the page at `pathname` is one of the entry's pages, or below one. */
export function isMenuActive(entry: MenuEntry, pathname: string): boolean {
  const links = entry.kind === "link" ? [entry.link] : entry.groups.flatMap((g) => g.links);
  return links.some((l) => pathname === l.to || (!l.end && pathname.startsWith(`${l.to}/`)));
}
