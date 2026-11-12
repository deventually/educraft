/**
 * The boundary for a PowerPoint template upload (P30.7b), for a teacher's own and a team's:
 * a size guard before the body is read, Zod on the form, the right extension, and then
 * `checkPptxTemplate` on the bytes (a real PowerPoint package, no macros, no zip bomb, a
 * layout we can fill). Only a file that passes reaches the repository.
 */
import { z } from "zod";
import {
  checkPptxTemplate,
  MAX_TEMPLATE_BYTES,
  type TemplateError,
} from "~/lib/export/pptxTemplate";

export type UploadError = TemplateError | "noFile" | "wrongType";

/** The form: the intent, and for an upload the file. */
const Upload = z.discriminatedUnion("intent", [
  z.object({ intent: z.literal("upload"), file: z.instanceof(File) }),
  z.object({ intent: z.literal("delete") }),
]);

export type TemplateForm =
  | { intent: "upload"; name: string; bytes: Uint8Array }
  | { intent: "delete" }
  | { error: UploadError };

/** Room for the multipart wrapping around the largest allowed file. */
const MAX_BODY = MAX_TEMPLATE_BYTES + 64 * 1024;

export async function readTemplateForm(request: Request): Promise<TemplateForm> {
  const length = Number(request.headers.get("Content-Length") ?? 0);
  if (length > MAX_BODY) return { error: "tooLarge" };
  let fd: FormData;
  try {
    fd = await request.formData();
  } catch {
    return { error: "noFile" };
  }
  const parsed = Upload.safeParse({ intent: fd.get("intent"), file: fd.get("file") ?? undefined });
  if (!parsed.success) return { error: "noFile" };
  if (parsed.data.intent === "delete") return { intent: "delete" };
  const { file } = parsed.data;
  if (file.size === 0) return { error: "noFile" };
  if (file.size > MAX_TEMPLATE_BYTES) return { error: "tooLarge" };
  if (!/\.(pptx|potx)$/i.test(file.name)) return { error: "wrongType" };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = await checkPptxTemplate(bytes);
  if (!check.ok) return { error: check.error };
  // Only the base name, without anything that could be read as a path.
  const name = file.name.split(/[\\/]/).at(-1)?.slice(0, 200) ?? "template.pptx";
  return { intent: "upload", name, bytes };
}
