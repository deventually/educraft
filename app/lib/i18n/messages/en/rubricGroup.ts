import type { Messages } from "../nl";

/** How the group did, per round of closed fill-ins (P36.1): counted in code, no AI, no names. */
export const rubricGroup: Messages["rubricGroup"] = {
  caption: "{criterion}: {lowest} of {scored} on the lowest level ({percent}%)",
  count: "Count",
  intro:
    "{n} closed fill-ins in {round}, without names. The criterion with the most work on the lowest level comes first.",
  level: "Level",
  roundOption: "{round} ({n})",
  rounds: "Round",
  title: "How the group did",
  tooFew:
    "From {min} closed fill-ins in a round you see here how the group scored, so no student can be recognised. In this round: {n}.",
};
