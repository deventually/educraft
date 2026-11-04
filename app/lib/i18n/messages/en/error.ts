import type { Messages } from "../nl";

export const error: Messages["error"] = {
  documentTooLong:
    "This document is too long: {max} characters at most. Shorten it or upload fewer files.",
  generic: "An unexpected error occurred.",
  invalidImages: "Invalid image format. Images must be PNG, JPEG, GIF or WebP.",
  invalidMessages: "Invalid message format.",
  invalidRequest: "Invalid request.",
  modelNoVision:
    "This model ({model}) does not support image analysis. Please select a vision-capable model.",
  notAllowed: "This tool is not available for your account.",
  notFound: "This page could not be found.",
  notFoundTitle: "404",
  quotaExceeded: "Daily limit reached — available again tomorrow.",
  rateLimited: "Too many requests. Please try again in a moment.",
  serverErrorTitle: "Error",
  title: "Oops!",
  tooManyImages: "Too many images. Maximum 10 images allowed.",
  unauthorized: "Log in to use this tool.",
  unknown: "Unknown error",
  unknownTool: "Unknown tool.",
};
