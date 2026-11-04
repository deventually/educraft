import type { Messages } from "../nl";

export const home: Messages["home"] = {
  heading: "Choose a tool",
  intro:
    "Each tool turns an evidence-based teaching method from The Pedagogical Promptbook into a working tool. Designed for Dutch higher professional education (hbo).",
  search: "Search by name, method or task…",
  resultCount: "{count} tools",
  resultCountOne: "{count} tool",
  noResults: "No tools found. Try a different search or filter.",
  clear: "Clear",
  backToGoals: "Back to goal view",
  stages: "{count} stages",
  mode: {
    generator: "Form",
    chatbot: "Chat",
  },
  a11y: {
    search: "Search tools",
    clearSearch: "Clear search",
    goalRegion: "Tools by teaching goal",
    resultsRegion: "Search results",
    open: "Open tool",
    generator: "form",
    chatbot: "chat",
  },
};
