import type { Messages } from "../nl";
import { about } from "./about";
import { account } from "./account";
import { admin } from "./admin";
import { agents } from "./agents";
import { auditLog } from "./auditLog";
import { aiNotice } from "./aiNotice";
import { auth } from "./auth";
import { calendar } from "./calendar";
import { chat } from "./chat";
import { confirm } from "./confirm";
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
import { pages } from "./pages";
import { people } from "./people";
import { pilot } from "./pilot";
import { portfolio } from "./portfolio";
import { portfolioExport } from "./portfolioExport";
import { portfolioReadiness } from "./portfolioReadiness";
import { portfolioRehearsal } from "./portfolioRehearsal";
import { privacy } from "./privacy";
import { projects } from "./projects";
import { resultActions } from "./resultActions";
import { settings } from "./settings";
import { sharing } from "./sharing";
import { speech } from "./speech";
import { start } from "./start";
import { teams } from "./teams";
import { toast } from "./toast";
import { tool } from "./tool";
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
  agents,
  aiNotice,
  appName: "LimeOnIt",
  auditLog,
  auth,
  calendar,
  chat,
  confirm,
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
  pages,
  people,
  pilot,
  portfolio,
  portfolioExport,
  portfolioReadiness,
  portfolioRehearsal,
  privacy,
  projects,
  resultActions,
  settings,
  sharing,
  speech,
  start,
  tagline: "Design evidence-based education with generative AI",
  teams,
  toast,
  tool,
  utilities,
  week,
};
