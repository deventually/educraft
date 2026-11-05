import { about } from "./about";
import { account } from "./account";
import { admin } from "./admin";
import { agents } from "./agents";
import { aiNotice } from "./aiNotice";
import { auth } from "./auth";
import { calendar } from "./calendar";
import { chat } from "./chat";
import { confirm } from "./confirm";
import { courses } from "./courses";
import { documents } from "./documents";
import { error } from "./error";
import { features } from "./features";
import { feedback } from "./feedback";
import { footer } from "./footer";
import { help } from "./help";
import { home } from "./home";
import { language } from "./language";
import { meta } from "./meta";
import { nav } from "./nav";
import { pages } from "./pages";
import { people } from "./people";
import { portfolio } from "./portfolio";
import { portfolioExport } from "./portfolioExport";
import { privacy } from "./privacy";
import { projects } from "./projects";
import { resultActions } from "./resultActions";
import { settings } from "./settings";
import { start } from "./start";
import { teams } from "./teams";
import { toast } from "./toast";
import { tool } from "./tool";
import { utilities } from "./utilities";

/**
 * Dutch UI strings — the canonical source of truth for the message shape.
 * `Messages = typeof nl`, so every other locale must match this structure
 * (enforced by tests/i18n.test.ts). No `as const`: values widen to `string`
 * so other locales can supply their own translations.
 *
 * One file per namespace (`./<namespace>.ts`), listed alphabetically, so PRs
 * that touch different parts of the UI do not edit the same file. A new
 * namespace = a new file in nl/ and en/ plus one line here and in en/index.ts.
 *
 * Interpolation uses single-brace placeholders, e.g. "Niveau {n}". Resolve them
 * with `fmt()` from "~/lib/i18n/format".
 */
export const nl = {
  about,
  account,
  admin,
  agents,
  aiNotice,
  appName: "LimeOnIt",
  auth,
  calendar,
  chat,
  confirm,
  courses,
  documents,
  error,
  features,
  feedback,
  footer,
  help,
  home,
  language,
  meta,
  nav,
  pages,
  people,
  portfolio,
  portfolioExport,
  privacy,
  projects,
  resultActions,
  settings,
  start,
  tagline: "Evidence-based onderwijs ontwerpen met generatieve AI",
  teams,
  toast,
  tool,
  utilities,
};

export type Messages = typeof nl;
