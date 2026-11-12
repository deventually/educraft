import type { Route } from "./+types/teams.$id.slide-template";
import { requireRole } from "~/server/auth.server";
import { getTeamForLead } from "~/server/repositories/teams.server";
import { deleteTeamTemplate, saveTeamTemplate } from "~/server/repositories/slideTemplates.server";
import { readTemplateForm } from "~/server/slideTemplateUpload.server";

/**
 * Resource route (no UI): POST /teams/:id/slide-template → the team's PowerPoint template
 * (P30.7b), upload or remove, by the team's lead only. Anyone else gets a 404 before the body
 * is read, as on the team page.
 */
export async function action({ request, params }: Route.ActionArgs) {
  const user = await requireRole(request, "teacher", "admin");
  if (!(await getTeamForLead(user.id, params.id))) throw new Response("Not found", { status: 404 });
  const form = await readTemplateForm(request);
  if ("error" in form) return { error: form.error };
  if (form.intent === "delete") {
    await deleteTeamTemplate(user.id, params.id);
    return { ok: "deleted" as const };
  }
  await saveTeamTemplate(user.id, params.id, form.name, form.bytes);
  return { ok: "saved" as const, name: form.name };
}
