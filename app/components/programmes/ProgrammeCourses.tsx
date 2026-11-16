import { Form } from "react-router";
import { AddDialog } from "~/components/connections/AddDialog";
import { ConnectionList } from "~/components/connections/ConnectionList";
import { Button } from "~/components/ui";
import { PlacementFields, usePlacementText } from "~/components/programmes/PlacementFields";
import { fmt } from "~/lib/i18n/format";
import { useT } from "~/lib/i18n/useT";

interface ProgrammeCourse {
  courseId: string;
  name: string;
  ownerName: string;
  year: number | null;
  period: number | null;
  mine: boolean;
}

/**
 * The courses of a programme, in the fixed pattern (plan step 3): "Cursus toevoegen" adds
 * several own courses at one year and period; each row moves its own course and has
 * Weghalen, which asks first. Only a member of one of its teams adds (`canPlace`).
 */
export function ProgrammeCourses({
  id,
  programme,
  available,
  canPlace,
}: {
  id: string;
  programme: { name: string; teamName: string; canManage: boolean; courses: ProgrammeCourse[] };
  available: { id: string; name: string }[];
  canPlace: boolean;
}) {
  const p = useT().programmes;
  const placementText = usePlacementText();
  return (
    <div>
      <ConnectionList
        title={p.courses.title}
        intro={canPlace ? p.courses.intro : `${p.courses.intro} ${p.addNotMember}`}
        empty={p.courses.empty}
        add={
          canPlace && (
            <AddDialog
              triggerLabel={p.addCourse}
              title={fmt(p.addCourseTitle, { programme: programme.name })}
              description={fmt(p.sharesWith, { team: programme.teamName })}
              intent="add-courses"
              pick={{
                name: "courseId",
                options: available.map((c) => ({ id: c.id, label: c.name })),
                empty: p.addNone,
              }}
            >
              <div className="flex flex-wrap items-end gap-3">
                <PlacementFields id={`${id}-new`} />
              </div>
              <p className="text-xs text-slate-500">{p.yearPeriodHint}</p>
            </AddDialog>
          )
        }
        items={programme.courses.map((c) => ({
          id: c.courseId,
          name: c.name,
          href: c.mine ? `/courses/${c.courseId}` : `/courses/shared/${c.courseId}`,
          meta: c.mine
            ? placementText(c)
            : `${fmt(p.owner, { name: c.ownerName })} · ${placementText(c)}`,
          actions: c.mine && (
            <Form method="post" className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="intent" value="place" />
              <input type="hidden" name="courseId" value={c.courseId} />
              <PlacementFields
                id={`${id}-${c.courseId}`}
                year={c.year}
                period={c.period}
                label={c.name}
              />
              <Button type="submit" size="sm" variant="secondary">
                {p.save}
                <span className="sr-only"> ({c.name})</span>
              </Button>
            </Form>
          ),
          remove:
            c.mine || programme.canManage
              ? {
                  fields: { intent: "remove", courseId: c.courseId },
                  title: fmt(p.removeCourseTitle, { course: c.name, programme: programme.name }),
                  description: p.removeCourseBody,
                }
              : undefined,
        }))}
      />
    </div>
  );
}
