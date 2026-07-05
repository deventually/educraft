import { Form, Link } from "react-router";
import { Trash2, UserMinus, Users, Wrench } from "lucide-react";
import type { Route } from "./+types/admin.cohorts";
import { requireRole } from "~/server/auth.server";
import {
  addCohortTeacher,
  allowedSlugsOf,
  countCohortMembers,
  deleteCohort,
  getCohortTeacherIds,
  listAllCohorts,
  removeCohortTeacher,
  setCohortOwner,
} from "~/server/repositories/cohorts.server";
import { listUsers } from "~/server/repositories/users.server";
import { useT, useLocale } from "~/lib/i18n/useT";
import { Button, Card, Select } from "~/components/ui";
import { ConfirmDialog } from "~/components/ConfirmDialog";

export async function loader({ request }: Route.LoaderArgs) {
  await requireRole(request, "admin");
  const [cohorts, users] = await Promise.all([listAllCohorts(), listUsers()]);
  const nameById = new Map(users.map((u) => [u.id, u.name]));
  const rows = await Promise.all(
    cohorts.map(async (c) => {
      const teacherIds = [...(await getCohortTeacherIds(c.id))];
      // An orphan cohort's creator account is gone (e.g. the teacher was removed).
      // It survives for reassignment; only a co-teacher-less orphan needs an owner.
      const orphaned = !nameById.has(c.createdByUserId);
      return {
        id: c.id,
        name: c.name,
        ownerName: nameById.get(c.createdByUserId) ?? c.createdByUserId,
        ownerId: c.createdByUserId,
        orphaned,
        toolCount: allowedSlugsOf(c).size,
        memberCount: await countCohortMembers(c.id),
        activeUntil: c.activeUntil,
        teachers: teacherIds.map((id) => ({ id, name: nameById.get(id) ?? id })),
      };
    }),
  );
  // Assignable co-teachers = teachers/admins.
  const assignable = users
    .filter((u) => u.role === "teacher" || u.role === "admin")
    .map((u) => ({ id: u.id, name: u.name }));
  return { rows, assignable };
}

export async function action({ request }: Route.ActionArgs) {
  await requireRole(request, "admin");
  const fd = await request.formData();
  const intent = String(fd.get("intent") ?? "");
  const cohortId = String(fd.get("cohortId") ?? "");

  if (intent === "delete") {
    await deleteCohort(cohortId);
    return { deleted: true as const };
  }
  if (intent === "assign") {
    await addCohortTeacher(cohortId, String(fd.get("userId") ?? ""));
    return { assigned: true as const };
  }
  if (intent === "reassignOwner") {
    await setCohortOwner(cohortId, String(fd.get("userId") ?? ""));
    return { reassigned: true as const };
  }
  if (intent === "remove") {
    await removeCohortTeacher(cohortId, String(fd.get("userId") ?? ""));
    return { removed: true as const };
  }
  return { error: true as const };
}

export default function AdminCohorts({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const locale = useLocale();
  const { rows, assignable } = loaderData;

  return (
    <section>
      <h2 className="font-display text-lg font-medium tracking-tight text-slate-900">
        {t.admin.cohorts.heading}
      </h2>
      <p className="mt-1 text-sm text-slate-600">{t.admin.cohorts.intro}</p>

      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">{t.admin.cohorts.empty}</p>
      ) : (
        <ul className="mt-5 flex list-none flex-col gap-4 p-0">
          {rows.map((c) => {
            // Teachers not already the owner or assigned → still assignable here.
            const assignedIds = new Set([c.ownerId, ...c.teachers.map((x) => x.id)]);
            const options = assignable.filter((u) => !assignedIds.has(u.id));
            return (
              <li key={c.id}>
                <Card className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-slate-900">{c.name}</h3>
                      <p className="mt-0.5 text-sm text-slate-500">
                        {t.admin.cohorts.colOwner}:{" "}
                        {c.orphaned ? (
                          <span className="font-medium text-amber-700">
                            {t.admin.cohorts.orphaned}
                          </span>
                        ) : (
                          c.ownerName
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/cohorts/${c.id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                      >
                        <Wrench className="size-3.5" aria-hidden />
                        {t.admin.cohorts.editTools}
                      </Link>
                      <ConfirmDialog
                        triggerLabel={t.admin.cohorts.delete}
                        triggerIcon={<Trash2 className="size-3.5" aria-hidden />}
                        title={t.admin.cohorts.deleteTitle}
                        description={t.admin.cohorts.confirmDelete}
                        confirmLabel={t.admin.cohorts.delete}
                        cancelLabel={t.confirm.cancel}
                        fields={{ intent: "delete", cohortId: c.id }}
                      />
                    </div>
                  </div>

                  <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600">
                    <div className="flex gap-1.5">
                      <dt className="text-slate-400">{t.admin.cohorts.colMembers}:</dt>
                      <dd className="font-medium tabular-nums">{c.memberCount}</dd>
                    </div>
                    <div className="flex gap-1.5">
                      <dt className="text-slate-400">{t.admin.cohorts.colActiveUntil}:</dt>
                      <dd className="font-medium">
                        {c.activeUntil ? fmtDate(c.activeUntil, locale) : t.admin.cohorts.openEnd}
                      </dd>
                    </div>
                  </dl>

                  {/* Orphan hand-over: only offered when no co-teacher already
                      manages it (a co-teacher can take it over as-is). */}
                  {c.orphaned && c.teachers.length === 0 && options.length > 0 && (
                    <Form
                      method="post"
                      className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3"
                    >
                      <input type="hidden" name="intent" value="reassignOwner" />
                      <input type="hidden" name="cohortId" value={c.id} />
                      <label
                        htmlFor={`owner-${c.id}`}
                        className="text-sm font-medium text-amber-800"
                      >
                        {t.admin.cohorts.reassignOwnerLabel}
                      </label>
                      <Select
                        id={`owner-${c.id}`}
                        name="userId"
                        defaultValue=""
                        className="w-auto"
                        required
                      >
                        <option value="" disabled>
                          {t.admin.cohorts.chooseTeacher}
                        </option>
                        {options.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                      </Select>
                      <Button type="submit" variant="secondary" size="sm">
                        {t.admin.cohorts.reassignOwner}
                      </Button>
                    </Form>
                  )}

                  {/* Teacher assignment */}
                  <div className="mt-4 border-t border-slate-100 pt-4">
                    <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <Users className="size-3.5" aria-hidden />
                      {t.admin.cohorts.manageTeachers}
                    </p>
                    {c.teachers.length === 0 ? (
                      <p className="mt-2 text-sm text-slate-500">{t.admin.cohorts.assignedNone}</p>
                    ) : (
                      <ul className="mt-2 flex flex-wrap gap-2">
                        {c.teachers.map((teacher) => (
                          <li key={teacher.id}>
                            <Form method="post" className="inline-flex">
                              <input type="hidden" name="intent" value="remove" />
                              <input type="hidden" name="cohortId" value={c.id} />
                              <input type="hidden" name="userId" value={teacher.id} />
                              <button
                                type="submit"
                                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 py-1 pl-3 pr-2 text-sm text-slate-700 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                              >
                                {teacher.name}
                                <UserMinus className="size-3.5" aria-hidden />
                                <span className="sr-only">{t.admin.cohorts.removeTeacher}</span>
                              </button>
                            </Form>
                          </li>
                        ))}
                      </ul>
                    )}

                    {options.length > 0 && (
                      <Form method="post" className="mt-3 flex flex-wrap items-center gap-2">
                        <input type="hidden" name="intent" value="assign" />
                        <input type="hidden" name="cohortId" value={c.id} />
                        <label htmlFor={`assign-${c.id}`} className="sr-only">
                          {t.admin.cohorts.addTeacherLabel} — {c.name}
                        </label>
                        <Select
                          id={`assign-${c.id}`}
                          name="userId"
                          defaultValue=""
                          className="w-auto"
                          required
                        >
                          <option value="" disabled>
                            {t.admin.cohorts.chooseTeacher}
                          </option>
                          {options.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name}
                            </option>
                          ))}
                        </Select>
                        <Button type="submit" variant="secondary" size="sm">
                          {t.admin.cohorts.addTeacher}
                        </Button>
                      </Form>
                    )}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function fmtDate(d: Date | string, locale: string): string {
  const date = d instanceof Date ? d : new Date(d);
  const intlLocale = locale === "en" ? "en-GB" : "nl-NL";
  return date.toLocaleDateString(intlLocale, { dateStyle: "medium" });
}
