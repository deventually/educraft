/**
 * Client-side text extraction for uploaded internship/thesis documents.
 *
 * A deep module with a narrow surface: callers hand over bytes (or a `File`)
 * and get back plain text destined for a textarea. The heavy PDF/DOCX libraries
 * are loaded lazily so they stay out of the main bundle and only execute in the
 * browser when a teacher actually picks a file. `unpdf` and `mammoth` both run
 * unchanged in Node (tests) and the browser (Vite), so there is one code path.
 */

/** Max upload size: 15 MB. Reports are text-heavy but rarely larger. */
export const MAX_DOC_SIZE = 15 * 1024 * 1024;

/**
 * Extracted text above this length gets a "very large — watch token cost"
 * warning. ~40k chars ≈ 10k tokens; assessments add framework + context on top.
 */
export const LARGE_TEXT_THRESHOLD = 40_000;

export const PDF_MIME = "application/pdf";
export const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** MIME allow-list for the upload boundary. */
export const ACCEPTED_DOC_MIMES = [PDF_MIME, DOCX_MIME] as const;

/** `accept` attribute for the file input (extensions + MIME for cross-browser). */
export const DOC_ACCEPT_ATTR = `.pdf,.docx,${PDF_MIME},${DOCX_MIME}`;

export interface ExtractResult {
  /** Extracted plain text (trimmed). Empty when nothing extractable was found. */
  text: string;
  /** True when no text could be extracted (e.g. a scanned / image-only PDF). */
  empty: boolean;
  /** Page count for PDFs; undefined for DOCX. */
  pageCount?: number;
  /** True when the text is large enough to be worth a token-cost warning. */
  large: boolean;
}

/** Thrown for invalid uploads (bad MIME, too large). Message is user-facing. */
export class DocumentExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocumentExtractionError";
  }
}

/** Validates size + MIME. Returns an error message, or undefined if valid. */
export function validateDocFile(size: number, mimeType: string): string | undefined {
  if (!ACCEPTED_DOC_MIMES.includes(mimeType as (typeof ACCEPTED_DOC_MIMES)[number])) {
    return `Unsupported file type: ${mimeType || "unknown"}. Upload a PDF or Word (.docx) file.`;
  }
  if (size > MAX_DOC_SIZE) {
    return `File too large: maximum size is ${Math.round(MAX_DOC_SIZE / (1024 * 1024))} MB.`;
  }
  return undefined;
}

/** Normalises a Uint8Array view into a standalone ArrayBuffer (browser input). */
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function finalize(text: string, pageCount?: number): ExtractResult {
  const trimmed = text.trim();
  return {
    text: trimmed,
    empty: trimmed.length === 0,
    pageCount,
    large: trimmed.length > LARGE_TEXT_THRESHOLD,
  };
}

async function extractPdf(bytes: Uint8Array): Promise<ExtractResult> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(bytes);
  const { totalPages, text } = await extractText(pdf, { mergePages: true });
  return finalize(text, totalPages);
}

async function extractDocx(bytes: Uint8Array): Promise<ExtractResult> {
  const mammoth = (await import("mammoth")).default;
  // Node build reads `buffer`, browser build reads `arrayBuffer` — pass both.
  const { value } = await mammoth.extractRawText({
    buffer: bytes,
    arrayBuffer: toArrayBuffer(bytes),
  } as Parameters<typeof mammoth.extractRawText>[0]);
  return finalize(value);
}

/**
 * Pure extractor: bytes + MIME → text. Runtime-agnostic and unit-testable.
 * Throws DocumentExtractionError for an unsupported MIME.
 */
export async function extractTextFromBytes(
  bytes: Uint8Array,
  mimeType: string,
): Promise<ExtractResult> {
  if (mimeType === PDF_MIME) return extractPdf(bytes);
  if (mimeType === DOCX_MIME) return extractDocx(bytes);
  throw new DocumentExtractionError(
    `Unsupported file type: ${mimeType || "unknown"}. Upload a PDF or Word (.docx) file.`,
  );
}

/**
 * Browser entry: validates a picked File then extracts its text.
 * Throws DocumentExtractionError (user-facing message) on invalid input.
 */
export async function fileToText(file: File): Promise<ExtractResult> {
  const error = validateDocFile(file.size, file.type);
  if (error) throw new DocumentExtractionError(error);
  const bytes = new Uint8Array(await file.arrayBuffer());
  return extractTextFromBytes(bytes, file.type);
}

export interface MergedDocumentResult {
  /** Combined text of all files; per-file `## filename` headings when >1 file. */
  text: string;
  /** Names of files that yielded no text (e.g. scans), skipped from `text`. */
  emptyFiles: string[];
  /** True when the combined text is large enough to warn about token cost. */
  large: boolean;
}

/**
 * Extracts and merges several uploaded files into one document — e.g. an
 * onderzoeksverslag plus a beroepsproduct uploaded together as a whole
 * portfolio. With more than one file each block gets a `## filename` heading so
 * the teacher (and the model) can tell the parts apart. A file with no text is
 * collected in `emptyFiles` rather than failing the whole batch; an invalid file
 * (bad type/size) throws DocumentExtractionError, prefixed with its name.
 */
export async function filesToDocumentText(files: File[]): Promise<MergedDocumentResult> {
  const multiple = files.length > 1;
  const blocks: string[] = [];
  const emptyFiles: string[] = [];

  for (const file of files) {
    let result: ExtractResult;
    try {
      result = await fileToText(file);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "extraction failed";
      throw new DocumentExtractionError(multiple ? `${file.name}: ${msg}` : msg);
    }
    if (result.empty) {
      emptyFiles.push(file.name);
      continue;
    }
    blocks.push(multiple ? `## ${file.name}\n\n${result.text}` : result.text);
  }

  const text = blocks.join("\n\n");
  return { text, emptyFiles, large: text.length > LARGE_TEXT_THRESHOLD };
}
