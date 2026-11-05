import type { Messages } from "../nl";
import { about } from "./about";
import { account } from "./account";
import { admin } from "./admin";
import { aiNotice } from "./aiNotice";
import { auth } from "./auth";
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
 * English UI strings. Must mirror the shape of `nl` exactly — tests/i18n.test.ts
 * enforces identical key sets and matching interpolation placeholders.
 * One file per namespace, like nl/ (see nl/index.ts).
 */
export const en: Messages = {
  about,
  account,
  admin,
  aiNotice,
  appName: "LimeOnIt",
  auth,
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
  tagline: "Design evidence-based education with generative AI",
  teams,
  toast,
  tool,
  utilities,
};
