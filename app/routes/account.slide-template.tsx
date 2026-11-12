import type { Route } from "./+types/account.slide-template";
import { requireRole } from "~/server/auth.server";
import { deleteOwnTemplate, saveOwnTemplate } from "~/server/repositories/slideTemplates.server";
import { readTemplateForm } from "~/server/slideTemplateUpload.server";

/**
 * Resource route (no UI): POST /account/slide-template → the teacher's own PowerPoint template
 * (P30.7b), upload or remove. The file is checked at the boundary (`readTemplateForm`).
 */
export async function action({ request }: Route.ActionArgs) {
  const user = await requireRole(request, "teacher", "admin");
  const form = await readTemplateForm(request);
  if ("error" in form) return { error: form.error };
  if (form.intent === "delete") {
    await deleteOwnTemplate(user.id);
    return { ok: "deleted" as const };
  }
  await saveOwnTemplate(user.id, form.name, form.bytes);
  return { ok: "saved" as const, name: form.name };
}
