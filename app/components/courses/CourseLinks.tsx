import { Form } from "react-router";
import { GraduationCap, Unlink } from "lucide-react";
import { Badge, Button, Label, Select } from "~/components/ui";
import { type GenerationCourseLink, type LinkTarget, linkTargetValue } from "~/lib/courses/links";
import { fmt } from "~/lib/i18n/format";
import { useT } from "~/lib/i18n/useT";

/** The courses a piece of work is linked to, as badges on its "Mijn werk" row (P20.4). */
export function CourseLinkBadges({ links }: { links: GenerationCourseLink[] }) {
  return links.map((l) => (
    <Badge key={l.courseId} className="max-w-full gap-1 border-lime-200 bg-lime-50 text-lime-900">
      <GraduationCap className="size-3 shrink-0" aria-hidden />
      <span className="truncate">
        {l.itemTitle ? `${l.courseName} · ${l.itemTitle}` : l.courseName}
      </span>
    </Badge>
  ));
}

interface FormProps {
  generationId: string;
  targets: LinkTarget[];
  links: GenerationCourseLink[];
}

/** Link this work to a course (or one of its activities or assessments), or unlink it. */
export function CourseLinkForm({ generationId, targets, links }: FormProps) {
  const t = useT();
  const m = t.courses.links;
  if (targets.length === 0 && links.length === 0) return null;
  const selectId = `course-target-${generationId}`;
  return (
    <div className="space-y-2">
      {targets.length > 0 && (
        <Form method="post" className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="intent" value="linkCourse" />
          <input type="hidden" name="id" value={generationId} />
          <div className="w-full min-w-0 sm:w-auto">
            <Label htmlFor={selectId}>{m.label}</Label>
            <Select id={selectId} name="target" className="w-full sm:max-w-md">
              {targets.map((c) => (
                <optgroup key={c.courseId} label={c.courseName}>
                  <option value={linkTargetValue(c.courseId)}>
                    {fmt(m.wholeCourse, { course: c.courseName })}
                  </option>
                  {c.items.map((i) => (
                    <option key={i.id} value={linkTargetValue(c.courseId, i.id)}>
                      {i.title}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </div>
          <Button type="submit" variant="secondary" size="sm">
            {m.link}
          </Button>
        </Form>
      )}
      {links.map((l) => (
        <Form key={l.courseId} method="post">
          <input type="hidden" name="intent" value="unlinkCourse" />
          <input type="hidden" name="id" value={generationId} />
          <input type="hidden" name="courseId" value={l.courseId} />
          <Button type="submit" variant="ghost" size="sm">
            <Unlink className="size-4" aria-hidden />
            {fmt(m.unlinkFrom, { course: l.courseName })}
          </Button>
        </Form>
      ))}
    </div>
  );
}
