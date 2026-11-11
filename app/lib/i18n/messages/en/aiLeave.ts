import type { Messages } from "../nl";

export const aiLeave: Messages["aiLeave"] = {
  abort: "Stop",
  body: "Keep it running and the AI finishes and saves the result. Stop it and the AI stops at once, using no more tokens.",
  keep: "Keep running",
  stay: "Stay on this page",
  title: "The AI is still working",
};
