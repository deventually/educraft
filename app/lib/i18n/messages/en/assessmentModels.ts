import type { Messages } from "../nl";

export const assessmentModels: Messages["assessmentModels"] = {
  anyType: "No fixed type (choose in the tool)",
  cancel: "Cancel",
  copyStarter: "Copy to my models",
  delete: "Delete",
  deleteBody: "The model disappears from your list. Earlier assessments are kept.",
  deleteTitle: "Delete model?",
  documentTypes: "For which document types",
  documentTypesHelp:
    "When you pick one of these types in the tool, it fills in this model by itself. Pick no type and you choose the model in the tool yourself.",
  edit: "Edit",
  editModel: "Edit model",
  emptyBody: "Copy a starter model below and adapt it, or create a new model yourself.",
  emptyTitle: "No assessment models of your own yet",
  errorDocumentType: "Pick an existing document type.",
  errorFramework: "Fill in the assessment framework.",
  errorName: "Give the model a name.",
  errorNotFound: "That model or rubric does not exist (any more).",
  feedbackOnly: "Feedback only",
  framework: "Assessment framework / success criteria",
  frameworkHelp:
    "Required: without a framework the AI would decide by itself what good work is. A few clear success criteria are enough.",
  fromRubric: "Take over from a rubric",
  fromRubricAction: "Take over",
  fromRubricIntro: "Make a model from a rubric you built with the Rubric utility.",
  fromRubricLabel: "Rubric",
  heading: "Assessment models",
  interviewSetup: "Setup of the final interview (optional)",
  interviewSetupHelp:
    "For an internship: how the final interview goes in your programme. From a track with this model it is filled in already under Questions for the final interview.",
  interviewSetupPlaceholder:
    "e.g. Assessment at the workplace after the presentation, about the realisation (the second half of the internship). The student hands in the presentation beforehand.",
  intro:
    "An assessment model is your framework with success criteria, with or without a scale, for certain document types. When you pick a document type in Assess student work and give feedback, the tool fills in your model for that type.",
  name: "Name",
  newModel: "New model",
  pickerHelp:
    "Your own model for the chosen document type is filled in by itself. You can still change everything afterwards.",
  pickerLabel: "Assessment model",
  pickerManage: "Manage your models",
  pickerNone: "None (fill in yourself)",
  pickerOwn: "My models",
  pickerStarters: "Starter models",
  save: "Save",
  scale: "Grading scale and pass rules (optional)",
  scaleHelp: "Leave it empty for feedback only, without a judgement.",
  starters: "Starter models",
  startersIntro:
    "A start to adapt. Copy one to your own models; in the tool you can also pick them directly.",
  toastCopied: "Model added to your models",
  toastDeleted: "Model deleted",
  toastSaved: "Model saved",
};
