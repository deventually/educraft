/** Safe download names and headers for every export (P25.6, shared since P30.1). */

/** No path or control characters, at most 150 characters, always the extension. */
export function safeFileName(name: string, extension: string, fallback: string): string {
  const safe = name
    .replace(/[\\/:*?"<>|\p{Cc}]/gu, "-")
    .trim()
    .replace(/-+$/, "")
    .slice(0, 150);
  return `${safe || fallback}.${extension}`;
}

/** Download headers: an ASCII fallback for old clients, RFC 5987 for the real (UTF-8) name. */
export function attachmentHeaders(file: string, contentType: string): Record<string, string> {
  const ascii = file.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "_");
  return {
    "Content-Type": contentType,
    "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file)}`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };
}
