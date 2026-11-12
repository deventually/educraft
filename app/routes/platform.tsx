import { z } from "zod";
import type { Route } from "./+types/platform";
import { isOwner, requireRole } from "~/server/auth.server";
import {
  addInstitution,
  listArchived,
  listInstitutions,
  removeInstitution,
  restoreInstitution,
  setInstitutionActive,
} from "~/server/platformAdmin.server";
import { getTimeZone } from "~/server/repositories/settings.server";
import { PlatformPage } from "~/components/platform/PlatformPage";
import type { PlatformResult } from "~/components/platform/types";

/** The platform owner only; anyone else gets a 404, like a page that does not exist. */
async function requirePlatformOwner(request: Request) {
  const user = await requireRole(request, "admin");
  if (!(await isOwner(user))) throw new Response("Not found", { status: 404 });
  return user;
}

export async function loader({ request }: Route.LoaderArgs) {
  await requirePlatformOwner(request);
  const [institutions, archived, timeZone] = await Promise.all([
    listInstitutions(),
    listArchived(),
    getTimeZone(),
  ]);
  return { institutions, archived, timeZone };
}

const text = (max: number) => z.string().trim().max(max);

const ActionSchema = z.discriminatedUnion("intent", [
  z.object({
    intent: z.literal("add"),
    id: text(31),
    name: text(100),
    host: text(253),
    adminName: text(100),
    adminEmail: text(254),
  }),
  z.object({ intent: z.enum(["activate", "deactivate"]), id: text(31) }),
  z.object({ intent: z.literal("remove"), id: text(31), confirm: text(31) }),
  z.object({ intent: z.literal("restore"), key: text(200) }),
]);

export async function action({ request }: Route.ActionArgs): Promise<PlatformResult> {
  await requirePlatformOwner(request);
  const parsed = ActionSchema.safeParse(Object.fromEntries(await request.formData()));
  if (!parsed.success) return { intent: "unknown", ok: false, error: "unknown" };
  const input = parsed.data;
  const nameOf = async (id: string) =>
    (await listInstitutions()).find((i) => i.id === id)?.name ?? id;

  switch (input.intent) {
    case "add": {
      const { intent, ...fields } = input;
      const res = await addInstitution(fields, new URL(request.url).protocol);
      if (!res.ok) return { intent, ok: false, error: res.error };
      return {
        intent,
        ok: true,
        name: fields.name,
        adminName: fields.adminName,
        setPasswordLink: res.setPasswordLink,
      };
    }
    case "activate":
    case "deactivate": {
      const { intent, id } = input;
      if (!(await setInstitutionActive(id, intent === "activate"))) {
        return { intent, ok: false, error: "unknown" };
      }
      return { intent, ok: true, name: await nameOf(id) };
    }
    case "remove": {
      const name = await nameOf(input.id);
      const res = await removeInstitution(input.id, input.confirm);
      if (!res.ok) return { intent: input.intent, ok: false, error: res.error };
      return { intent: input.intent, ok: true, name };
    }
    case "restore": {
      const name = (await listArchived()).find((a) => a.key === input.key)?.name;
      const res = await restoreInstitution(input.key);
      if (!res.ok) return { intent: input.intent, ok: false, error: res.error };
      return { intent: input.intent, ok: true, name };
    }
  }
}

export default function Platform({ loaderData }: Route.ComponentProps) {
  return <PlatformPage {...loaderData} />;
}
