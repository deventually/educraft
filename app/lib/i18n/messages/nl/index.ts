import { about } from "./about";
import { account } from "./account";
import { admin } from "./admin";
import { adminErrors } from "./adminErrors";
import { agents } from "./agents";
import { auditLog } from "./auditLog";
import { aiLeave } from "./aiLeave";
import { aiNotice } from "./aiNotice";
import { announcements } from "./announcements";
import { assessmentModels } from "./assessmentModels";
import { auth } from "./auth";
import { calendar } from "./calendar";
import { chat } from "./chat";
import { confirm } from "./confirm";
import { courseCopy } from "./courseCopy";
import { courseDesign } from "./courseDesign";
import { courseDocuments } from "./courseDocuments";
import { courseMembers } from "./courseMembers";
import { courseTools } from "./courseTools";
import { courses } from "./courses";
import { documents } from "./documents";
import { error } from "./error";
import { exportResult } from "./exportResult";
import { features } from "./features";
import { feedback } from "./feedback";
import { footer } from "./footer";
import { help } from "./help";
import { home } from "./home";
import { language } from "./language";
import { meta } from "./meta";
import { modelAdmin } from "./modelAdmin";
import { nav } from "./nav";
import { organisation } from "./organisation";
import { pages } from "./pages";
import { people } from "./people";
import { pilot } from "./pilot";
import { platform } from "./platform";
import { portfolio } from "./portfolio";
import { portfolioExport } from "./portfolioExport";
import { portfolioGuided } from "./portfolioGuided";
import { portfolioOutline } from "./portfolioOutline";
import { portfolioPlan } from "./portfolioPlan";
import { portfolioReadiness } from "./portfolioReadiness";
import { portfolioRehearsal } from "./portfolioRehearsal";
import { portfolioRoute } from "./portfolioRoute";
import { portfolioStart } from "./portfolioStart";
import { privacy } from "./privacy";
import { programmes } from "./programmes";
import { projects } from "./projects";
import { resultActions } from "./resultActions";
import { settings } from "./settings";
import { sharing } from "./sharing";
import { speech } from "./speech";
import { start } from "./start";
import { teams } from "./teams";
import { toast } from "./toast";
import { tool } from "./tool";
import { twoFactor } from "./twoFactor";
import { usage } from "./usage";
import { utilities } from "./utilities";
import { week } from "./week";

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
  adminErrors,
  agents,
  aiLeave,
  aiNotice,
  announcements,
  appName: "LimeOnIt",
  assessmentModels,
  auditLog,
  auth,
  calendar,
  chat,
  confirm,
  courseCopy,
  courseDesign,
  courseDocuments,
  courseMembers,
  courses,
  courseTools,
  documents,
  error,
  exportResult,
  features,
  feedback,
  footer,
  help,
  home,
  language,
  meta,
  modelAdmin,
  nav,
  organisation,
  pages,
  people,
  pilot,
  platform,
  portfolio,
  portfolioExport,
  portfolioGuided,
  portfolioOutline,
  portfolioPlan,
  portfolioReadiness,
  portfolioRehearsal,
  portfolioRoute,
  portfolioStart,
  privacy,
  programmes,
  projects,
  resultActions,
  settings,
  sharing,
  speech,
  start,
  tagline: "Evidence-based onderwijs ontwerpen met generatieve AI",
  teams,
  toast,
  tool,
  twoFactor,
  usage,
  utilities,
  week,
};

export type Messages = typeof nl;
