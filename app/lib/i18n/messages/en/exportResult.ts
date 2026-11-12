/** Exporting a result (brief P30). */
export const exportResult = {
  button: "Export",
  download: "Download as {format}",
  formats: { docx: "Word (.docx)", md: "Markdown (.md)", pptx: "PowerPoint (.pptx)" },
  intro: "This is what the file looks like.",
  loading: "Loading preview…",
  newTab: "(opens in a new tab)",
  preview: "Export preview",
  print: "Print or save as PDF",
  printHint: 'Choose "Save as PDF" in the print window to make a PDF.',
  slides: {
    intro:
      "The slides show the learning goal, the steps of each phase and coming back. What is meant for you is in the speaker notes.",
    next: "Next slide",
    notes: "Speaker notes",
    position: "Slide {n} of {total}",
    preview: "Slide preview",
    previous: "Previous slide",
  },
  templates: {
    choose: "PowerPoint template",
    current: "Current template",
    delete: "Remove template {name}",
    deleted: "Template removed.",
    errors: {
      macros: "This file contains macros. Save it as a .pptx or .potx without macros.",
      noFile: "Choose a file first.",
      noLayout:
        'This template has no layout with a title and a text area, such as "Title and Content".',
      notPowerPoint: "This is not a PowerPoint file. Choose a .pptx or .potx.",
      tooLarge: "This file is too large. A template can be 10 MB at most.",
      wrongType: "Choose a file that ends in .pptx or .potx.",
    },
    field: "Template (.pptx or .potx, max. 10 MB)",
    heading: "PowerPoint template",
    introOwn:
      "Upload your school's PowerPoint template. When you export slides, you choose whether LimeOnIt uses it: your slides then get the \"Title and Content\" layout, with the template's logo, colours and fonts.",
    introTeam:
      "Upload a PowerPoint template for this team. Every member can choose it when exporting slides.",
    own: "My template: {name}",
    saved: "Template {name} saved.",
    standard: "LimeOnIt (default)",
    team: "{team}: {name}",
    upload: "Upload template",
  },
};
