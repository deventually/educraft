/**
 * Loads an uploaded file for the document viewer (24.0c). Everything happens on
 * the `File` in browser memory: nothing is uploaded and nothing is stored. The
 * heavy libraries are imported lazily, as in `extract.ts`.
 */
import { DOCX_MIME, PDF_MIME, DocumentExtractionError } from "./extract";
import { docxToSafeNodes, type SafeNode } from "./docxHtml";
import { pageLayout, type PageLayout } from "./pdfLayout";

export type OriginalDoc =
  | {
      kind: "pdf";
      /** Extracted text per page (index 0 = page 1): the search space and the text alternative. */
      pages: string[];
      /** Where the text sits on each page, to mark a hit on the page itself. */
      layouts: PageLayout[];
      /** Draws one page (1-based), `width` pixels wide, as a `data:` image URL. Browser only. */
      renderPage: (pageNumber: number, width: number) => Promise<string>;
    }
  | { kind: "docx"; nodes: SafeNode[] };

export async function loadOriginal(file: File): Promise<OriginalDoc> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (file.type === PDF_MIME) {
    const { extractTextItems, getDocumentProxy, renderPageAsImage } = await import("unpdf");
    const pdf = await getDocumentProxy(bytes);
    const { items } = await extractTextItems(pdf);
    const layouts = await Promise.all(
      items.map(async (pageItems, i) => {
        const page = await pdf.getPage(i + 1);
        return pageLayout(pageItems, page.getViewport({ scale: 1 }).viewBox);
      }),
    );
    return {
      kind: "pdf",
      // The same text as unpdf's extractText, built from the same items.
      pages: layouts.map((l) => l.text),
      layouts,
      renderPage: (pageNumber, width) =>
        renderPageAsImage(pdf, pageNumber, { width, toDataURL: true }),
    };
  }
  if (file.type === DOCX_MIME) {
    return { kind: "docx", nodes: await docxToSafeNodes(bytes) };
  }
  throw new DocumentExtractionError(`Unsupported file type: ${file.type || "unknown"}`);
}
