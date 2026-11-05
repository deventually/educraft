import { type RouteConfig, index, layout } from "@react-router/dev/routes";
import { account } from "./routing/account";
import { admin } from "./routing/admin";
import { api } from "./routing/api";
import { auth } from "./routing/auth";
import { courses } from "./routing/courses";
import { help } from "./routing/help";
import { info } from "./routing/info";
import { portfolio } from "./routing/portfolio";
import { projects } from "./routing/projects";
import { teams } from "./routing/teams";
import { tools } from "./routing/tools";
import { utilities } from "./routing/utilities";
import type { RouteArea } from "./routing/types";

/**
 * The routes live per part of the app in `app/routing/<area>.ts`, so PRs on different parts do
 * not edit the same file. A new area = a new file there plus one import and one line below
 * (alphabetical). Order does not matter: React Router ranks routes by specificity.
 */
const areas: RouteArea[] = [
  account,
  admin,
  api,
  auth,
  courses,
  help,
  info,
  portfolio,
  projects,
  teams,
  tools,
  utilities,
];

export default [
  layout("components/AppShell.tsx", [
    // `/` is a role-aware redirector (admin → /admin/users, else → /tools).
    index("routes/index.tsx"),
    ...areas.flatMap((a) => a.shell ?? []),
  ]),
  ...areas.flatMap((a) => a.standalone ?? []),
] satisfies RouteConfig;
