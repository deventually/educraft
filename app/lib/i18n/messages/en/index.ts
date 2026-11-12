import type { Messages } from "../nl";
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
import { courseEvaluation } from "./courseEvaluation";
import { courseImprovements } from "./courseImprovements";
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
import { portfolioBatch } from "./portfolioBatch";
import { portfolioExport } from "./portfolioExport";
import { portfolioFacts } from "./portfolioFacts";
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
import { rubricCalibrate } from "./rubricCalibrate";
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
 * English UI strings. Must mirror the shape of `nl` exactly — tests/i18n.test.ts
 * enforces identical key sets and matching interpolation placeholders.
 * One file per namespace, like nl/ (see nl/index.ts).
 */
export const en: Messages = {
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
  courseEvaluation,
  courseImprovements,
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
  portfolioBatch,
  portfolioExport,
  portfolioFacts,
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
  rubricCalibrate,
  settings,
  sharing,
  speech,
  start,
  tagline: "Design evidence-based education with generative AI",
  teams,
  toast,
  tool,
  twoFactor,
  usage,
  utilities,
  week,
};
