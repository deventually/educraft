/**
 * Loads an uploaded file for the document viewer (24.0c). Everything happens on
 * the `File` in browser memory: nothing is uploaded and nothing is stored. The
 * heavy libraries are imported lazily, as in `extract.ts`.
 */
import { DOCX_MIME, PDF_MIME, DocumentExtractionError } from "./extract";
import { docxToSafeNodes, type SafeNode } from "./docxHtml";

export type OriginalDoc =
  | {
      kind: "pdf";
      /** Extracted text per page (index 0 = page 1): the search space and the text alternative. */
      pages: string[];
      /** Draws one page (1-based) and returns it as a `data:` image URL. Browser only. */
      renderPage: (pageNumber: number) => Promise<string>;
    }
  | { kind: "docx"; nodes: SafeNode[] };

/** Device-pixel scale for drawn pages: sharp enough to read, small enough to keep memory sane. */
const RENDER_SCALE = 1.5;

export async function loadOriginal(file: File): Promise<OriginalDoc> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (file.type === PDF_MIME) {
    const { extractText, getDocumentProxy, renderPageAsImage } = await import("unpdf");
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: false });
    return {
      kind: "pdf",
      pages: text,
      renderPage: (pageNumber) =>
        renderPageAsImage(pdf, pageNumber, { scale: RENDER_SCALE, toDataURL: true }),
    };
  }
  if (file.type === DOCX_MIME) {
    return { kind: "docx", nodes: await docxToSafeNodes(bytes) };
  }
  throw new DocumentExtractionError(`Unsupported file type: ${file.type || "unknown"}`);
}
