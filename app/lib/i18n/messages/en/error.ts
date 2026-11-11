import type { Messages } from "../nl";

export const error: Messages["error"] = {
  documentTooLong:
    "This document is too long: {max} characters at most. Shorten it or upload fewer files.",
  generic: "An unexpected error occurred.",
  invalidImages: "Invalid image format. Images must be PNG, JPEG, GIF or WebP.",
  invalidMessages: "Invalid message format.",
  invalidRequest: "Invalid request.",
  limitReached:
    "The AI allowance for this month is used up. The Usage page shows which limit; your admin can raise it.",
  modelNoVision:
    "This model ({model}) does not support image analysis. Please select a vision-capable model.",
  notAllowed: "This tool is not available for your account.",
  notFound: "This page could not be found.",
  notFoundTitle: "404",
  quotaExceeded: "You have used a lot of AI today. It works again tomorrow.",
  rateLimited: "Too many requests. Please try again in a moment.",
  reportHint: "Report this to your admin, with the time and the page below.",
  reportPage: "Page",
  reportTime: "Time",
  serverErrorTitle: "Error",
  title: "Oops!",
  tooManyImages: "Too many images. Maximum 10 images allowed.",
  unauthorized: "Log in to use this tool.",
  unknown: "Unknown error",
  unknownTool: "Unknown tool.",
};
