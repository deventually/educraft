import type { Messages } from "../nl";

export const error: Messages["error"] = {
  title: "Oops!",
  generic: "An unexpected error occurred.",
  notFoundTitle: "404",
  notFound: "This page could not be found.",
  serverErrorTitle: "Error",
  unknownTool: "Unknown tool.",
  unknown: "Unknown error",
  invalidRequest: "Invalid request.",
  documentTooLong:
    "This document is too long: {max} characters at most. Shorten it or upload fewer files.",
  unauthorized: "Log in to use this tool.",
  notAllowed: "This tool is not available for your account.",
  rateLimited: "Too many requests. Please try again in a moment.",
  quotaExceeded: "Daily limit reached — available again tomorrow.",
  modelNoVision:
    "This model ({model}) does not support image analysis. Please select a vision-capable model.",
  invalidImages: "Invalid image format. Images must be PNG, JPEG, GIF or WebP.",
  tooManyImages: "Too many images. Maximum 10 images allowed.",
  invalidMessages: "Invalid message format.",
};
