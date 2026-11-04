import type { Messages } from "../nl";

export const privacy: Messages["privacy"] = {
  addSelection: "Remove the selected text",
  back: "Back",
  company: "Company or institution",
  companyDescription: "Description of the company (placed after the code)",
  companyDescriptionPlaceholder: "e.g. an online shop for sports goods",
  count: "{n} replacements",
  extra: "Other words to remove (one per line)",
  intro:
    "Fill in what must go. Names and other details are replaced by codes before anything goes to the AI. E-mail addresses, phone numbers, postcodes, IBANs and numbers that look like a student number are removed automatically. The names stay in your browser and come back in the result.",
  kept: "{original} is kept",
  limits:
    "Note: figures and photos are not anonymised, and a misspelt name or a very recognisable description can slip through. So check the text; you remain responsible.",
  preview: "What the AI receives: {field}",
  replaced: "{original} becomes {code}",
  restoredNote:
    "The names were put back in your browser. My work keeps the version with codes; the names do not come back there.",
  send: "Send anonymised",
  student: "Student name",
  studentNumber: "Student number",
  supervisors: "Supervisors (one per line)",
  title: "Anonymise first",
  undoHint: "Click a replacement to undo it, or again to turn it back on.",
};
