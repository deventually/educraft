import type { Messages } from "../nl";

export const privacy: Messages["privacy"] = {
  alsoReplace: "Also replace",
  alsoReplaceHint:
    "Select a word in the preview and choose Also replace. Click a replacement to keep the word.",
  askIntro:
    "The privacy gate found words you have not seen yet, for example in your context, your course or an earlier step. Nothing has been sent. Choose per word, then send.",
  askKeep: "Do not replace",
  askReplace: "Replace",
  askSend: "Send",
  askTitle: "Look first",
  askWord: "{value} ({n}×)",
  back: "Back",
  company: "Company or institution",
  companyDescription: "Description of the company (placed after the code)",
  companyDescriptionPlaceholder: "e.g. an online shop for sports goods",
  extra: "Other words to remove (one per line)",
  kept: "{original} is kept",
  limits:
    "Note: figures and photos are not anonymised, and a misspelt name or a very recognisable description can slip through. So check the text; you remain responsible.",
  liveCount: "{n} replaced",
  liveIntro:
    "Names and details go to the AI as codes; the result shows them again. What you see here is what goes.",
  liveNone: "Nothing is replaced.",
  liveTitle: "What goes to the AI",
  message: "Your message",
  namedIntro: "Student names and these details stay in your browser; the server only sees codes.",
  namedTitle: "Names that must go",
  neverRemove: "Replace {word} again",
  neverSaved: "{word} is on your never-list.",
  neverTitle: "Never replace",
  overviewAdd: "Replace another word",
  overviewAddHint: "For instance a name the list missed. The word is replaced everywhere.",
  overviewCount: "{n} words replaced",
  overviewCountOne: "1 word replaced",
  overviewCourse: "Your course",
  overviewIn: "in {where}",
  overviewIntro:
    "Nothing has been sent yet. Per word you see what is replaced, also in file and folder names. If it is right, choose Send.",
  overviewKept: "stays as it is",
  overviewMore: "{list} and {n} more",
  overviewTitle: "Check what goes to the AI",
  overviewWordAction: "{action}: {value}",
  preview: "What the AI receives: {field}",
  replaced: "{original} becomes {code}",
  restoredNote:
    "The names were put back in your browser. Earlier work keeps the version with codes; the names do not come back there.",
  student: "Student name",
  studentNumber: "Student number",
  supervisors: "Supervisors (one per line)",
};
