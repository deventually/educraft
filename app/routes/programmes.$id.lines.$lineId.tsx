import { useId } from "react";
import { Form, redirect, useActionData } from "react-router";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { Route } from "./+types/programmes.$id.lines.$lineId";
import { requireProgrammeUser } from "~/server/programmes.server";
import {
  deleteLine,
  getLine,
  moveCourse,
  renameLine,
  setLineCourses,
  setLineProgrammes,
} from "~/server/repositories/learningLines.server";
import { getProgramme, listProgrammes } from "~/server/repositories/programmes.server";
import { LineProgrammes } from "~/components/programmes/LineProgrammes";
import { learningLineOverview } from "~/lib/programmes/learningLine";
import { Button, Card, Input, Label } from "~/components/ui";
import { AddDialog } from "~/components/connections/AddDialog";
import { ConnectionList } from "~/components/connections/ConnectionList";
import { ConfirmDialog } from "~/components/ConfirmDialog";
import { useFormToast } from "~/components/Toast";
import { Breadcrumb } from "~/components/Breadcrumb";
import { LearningLineOverview } from "~/components/programmes/LearningLineOverview";
import { useT } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";
import { getMessages } from "~/lib/i18n";
import { getLocale } from "~/lib/i18n/locale.server";

export function meta({ loaderData: data }: Route.MetaArgs) {
  return [{ title: `${data?.line.name ?? "Leerlijn"} — LimeOnIt` }];
}

/** The line under the address of one of its programmes the user reads, or a 404. */
async function loadLine(request: Request, params: { id?: string; lineId?: string }) {
  const user = await requireProgrammeUser(request);
  const line = params.lineId ? await getLine(user, params.lineId) : null;
  if (!line?.programmes.some((p) => p.id === params.id))
    throw new Response("Not Found", { status: 404 });
  return { user, line };
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user, line } = await loadLine(request, params);
  const linked = (await Promise.all(line.programmes.map((p) => getProgramme(user, p.id)))).filter(
    (p) => p !== null,
  );
  const here = linked.find((p) => p.id === params.id);
  const inLine = new Set(line.courseIds);
  const addable = new Map<string, string>();
  for (const p of linked)
    for (const c of p.courses) if (!inLine.has(c.courseId)) addable.set(c.courseId, c.name);
  const linkedIds = new Set(line.programmes.map((p) => p.id));
  return {
    line: {
      id: line.id,
      name: line.name,
      programmeId: here?.id ?? line.programmeId,
      programmeName: here?.name ?? line.programmeName,
      teamName: here?.teamName ?? line.teamName,
      canManage: line.canManage,
      courses: line.courses.map((c) => ({ id: c.id, name: c.name })),
    },
    overview: learningLineOverview(line.courses),
    addable: [...addable].map(([id, name]) => ({ id, name })),
    alsoFor: line.programmes.filter((p) => p.id !== params.id),
    linkOptions: line.canManage
      ? (await listProgrammes(user, 500))
          .filter((p) => p.canManage && p.id !== line.programmeId)
          .map((p) => ({ id: p.id, name: p.name, linked: linkedIds.has(p.id) }))
      : [],
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { user, line } = await loadLine(request, params);
  const fd = await request.formData();
  const l = getMessages(getLocale(request)).programmes.lines;
  const intent = fd.get("intent");
  const courseId = String(fd.get("courseId") ?? "");
  const done = (ok: boolean) =>
    ok
      ? { ok: true as const, message: l.toastSaved }
      : { ok: false as const, error: l.errorNotAllowed };
  if (!line.canManage) return done(false);
  // Only the courses still visible in the programme; one that left it drops out on save.
  const visible = line.courses.map((c) => c.id);
  if (intent === "rename") {
    const name = String(fd.get("name") ?? "").trim();
    if (!name || name.length > 200) return { ok: false as const, error: l.errorName };
    return done(await renameLine(user, line.id, name));
  }
  if (intent === "move")
    return done(await moveCourse(user, line.id, courseId, fd.get("direction") === "up" ? -1 : 1));
  if (intent === "remove")
    return done(
      await setLineCourses(
        user,
        line.id,
        line.courseIds.filter((c) => c !== courseId),
      ),
    );
  if (intent === "add") {
    // Several at once (plan step 6), after the ones already in it; one already in stays put.
    const added = fd
      .getAll("courseId")
      .map(String)
      .filter((c) => !visible.includes(c));
    return done(await setLineCourses(user, line.id, [...new Set([...visible, ...added])]));
  }
  if (intent === "programmes")
    return done(
      await setLineProgrammes(
        user,
        line.id,
        fd.getAll("programmeId").map((v) => String(v)),
      ),
    );
  if (intent === "delete") {
    if (await deleteLine(user, line.id)) return redirect(`/programmes/${line.programmeId}`);
    return done(false);
  }
  return { ok: false as const, error: l.errorNotAllowed };
}

/** One learning line: its overview, and for the lead the order and the courses in it. */
export default function LearningLinePage({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const l = t.programmes.lines;
  const id = useId();
  const actionData = useActionData<typeof action>();
  useFormToast(actionData, {
    result: (d) => {
      if (!d) return null;
      return d.ok
        ? { variant: "success", message: d.message }
        : { variant: "error", message: d.error };
    },
  });
  const { line, overview, addable, alsoFor, linkOptions } = loaderData;

  return (
    <div className="w-full min-w-0">
      <Breadcrumb
        label={t.menu.breadcrumb}
        items={[
          { label: t.programmes.heading, to: "/programmes" },
          { label: line.programmeName, to: `/programmes/${line.programmeId}?tab=lines` },
          { label: l.allTitle, to: "/learning-lines" },
          { label: line.name },
        ]}
      />
      <h1 className="mt-2 font-display text-2xl font-medium tracking-tight text-slate-900">
        {line.name}
      </h1>
      <p className="mt-1 text-slate-600">
        {line.programmeName} · {t.programmes.team} {line.teamName}
      </p>
      {alsoFor.length > 0 && (
        <p className="mt-1 text-sm text-slate-600">
          {fmt(l.alsoFor, { programmes: alsoFor.map((p) => p.name).join(", ") })}
        </p>
      )}

      <div className="mt-6 space-y-10">
        {line.courses.length === 0 ? (
          <p className="text-slate-600">{l.emptyLine}</p>
        ) : (
          <LearningLineOverview overview={overview} />
        )}

        {line.canManage && (
          <>
            <ConnectionList
              title={l.coursesTitle}
              ordered
              empty={l.emptyLine}
              add={
                <AddDialog
                  triggerLabel={l.addCourse}
                  title={fmt(l.addCourseTitle, { line: line.name })}
                  description={l.addHint}
                  intent="add"
                  pick={{
                    name: "courseId",
                    options: addable.map((c) => ({ id: c.id, label: c.name })),
                    empty: l.addNone,
                  }}
                />
              }
              items={line.courses.map((c, i) => ({
                id: c.id,
                name: c.name,
                actions: (
                  <span className="flex flex-wrap gap-1">
                    {i > 0 && <MoveButton courseId={c.id} name={c.name} direction="up" />}
                    {i < line.courses.length - 1 && (
                      <MoveButton courseId={c.id} name={c.name} direction="down" />
                    )}
                  </span>
                ),
                remove: {
                  fields: { intent: "remove", courseId: c.id },
                  title: fmt(l.removeTitle, { course: c.name, line: line.name }),
                  description: l.removeBody,
                },
              }))}
            />
            <section aria-labelledby={`${id}-details`}>
              <h2 id={`${id}-details`} className="text-lg font-medium text-slate-900">
                {l.details}
              </h2>
              <Card className="mt-3 p-4">
                <Form method="post" className="flex flex-wrap items-end gap-3">
                  <input type="hidden" name="intent" value="rename" />
                  <div className="w-full sm:w-auto sm:min-w-48 sm:flex-1">
                    <Label htmlFor={`${id}-name`}>{l.name}</Label>
                    <Input
                      id={`${id}-name`}
                      name="name"
                      required
                      maxLength={200}
                      defaultValue={line.name}
                      className="mt-1"
                    />
                  </div>
                  <Button type="submit" size="sm">
                    {l.save}
                  </Button>
                </Form>
              </Card>
              {linkOptions.length > 0 && <LineProgrammes options={linkOptions} />}
            </section>
            <div>
              <ConfirmDialog
                triggerLabel={l.delete}
                title={l.deleteTitle}
                description={l.deleteBody}
                confirmLabel={l.delete}
                cancelLabel={t.confirm.cancel}
                fields={{ intent: "delete" }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function MoveButton({
  courseId,
  name,
  direction,
}: {
  courseId: string;
  name: string;
  direction: "up" | "down";
}) {
  const l = useT().programmes.lines;
  const Icon = direction === "up" ? ArrowUp : ArrowDown;
  return (
    <Form method="post">
      <input type="hidden" name="intent" value="move" />
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="direction" value={direction} />
      <Button type="submit" size="sm" variant="ghost">
        <Icon className="size-4" aria-hidden />
        {direction === "up" ? l.up : l.down}
        <span className="sr-only"> ({name})</span>
      </Button>
    </Form>
  );
}
