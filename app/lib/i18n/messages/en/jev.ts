/** TypeSafe Jev's one switch on Admin → Tools (BESLUIT-2026-11-17-1). */
export const jev = {
  akkoord:
    "Switching it on is the institution's consent: OpenRouter and TypeSafe then become processors of this data. The audit log keeps who did it and when.",
  heading: "TypeSafe Jev",
  intro:
    "Jev is a decision model by TypeSafe, reached through OpenRouter. It gives short judgments, such as the Bloom level of a learning outcome or which outcome a file belongs to. With Jev on, parts of course documents (learning outcomes, test titles and the text around them) and, in Evidence in one go, the file name and the start of each file go to OpenRouter. Student names the teacher lists are already replaced by codes, but it is not fully anonymous. With Jev off, the regular language model does this work.",
  keyMissing:
    "The key JEV_API_KEY is missing on the server. Until it is set, nothing goes to Jev, even when it is on.",
  label: "Use Jev",
  never: "Never switched on.",
  someone: "an admin",
  switchedOff: "Switched off by {name} on {when}.",
  switchedOn: "Switched on by {name} on {when}.",
};
