import type { Messages } from "../nl";

export const documents: Messages["documents"] = {
  aiEmpty: "No text yet. Upload a file or paste the text into the form.",
  aiHint: "This is exactly the text that goes to the AI. You edit it in the form.",
  aiTab: "What the AI receives",
  cannotShow: "This file cannot be shown here. Its extracted text still goes to the AI as usual.",
  file: "File",
  foundDocx: "Found and marked in the document.",
  foundPage: "Found on page {page}.",
  foundTimes: "Occurs {n} times; this is the first.",
  frameTitle: "Original: {name}",
  imageAlt: "Image from the document",
  loading: "Loading the original…",
  locate: "Show in document",
  match: "Match {i} of {n}",
  matchPage: "Match {i} of {n} (page {page})",
  noMatches: "No matches.",
  notFound:
    "Not found exactly in the original (perhaps worded differently). Use the search field yourself.",
  notStored:
    "The original stays in your browser and is not stored or sent. If you reopen this result later, pick the file again.",
  originalTab: "Original",
  page: "Page {n} of {total}",
  pageTextFallback: "No image of this page; this is the extracted text.",
  quotes: "Quotes from the result ({n})",
  search: "Search the original",
  searchButton: "Search",
  tabs: "View",
  title: "Document",
  tooShort: "This quote is too short to find back reliably.",
  wordNote: "Word view: headings, lists, tables and images are kept; colour and font are lost.",
};
