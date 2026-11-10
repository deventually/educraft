import { useId } from "react";
import { Form } from "react-router";
import { Button, Label, Select } from "~/components/ui";
import { useT } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";

type Role = "editor" | "co-owner";
interface Colleague {
  userId: string;
  name: string;
}

export interface PersonCoursesProps {
  list: { id: string; name: string; members: (Colleague & { role: Role })[] }[];
  colleagues: Colleague[];
}

const ROLES: Role[] = ["editor", "co-owner"];
const card = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";

function ColleagueSelect({
  id,
  name,
  options,
}: {
  id: string;
  name: string;
  options: Colleague[];
}) {
  const t = useT();
  return (
    <Select id={id} name={name} required defaultValue="" className="mt-1">
      <option value="" disabled>
        {t.courseMembers.addNone}
      </option>
      {options.map((p) => (
        <option key={p.userId} value={p.userId}>
          {p.name}
        </option>
      ))}
    </Select>
  );
}

/**
 * A teacher's courses on the admin's person page (BESLUIT-2026-11-10-5): hand one or all
 * of them to a colleague, and add or remove members, also when the teacher is gone.
 */
export function PersonCourses({ list, colleagues }: PersonCoursesProps) {
  const t = useT();
  const e = t.courseMembers;
  const a = e.admin;
  const id = useId();

  return (
    <section>
      <h2 className="font-display text-lg font-medium tracking-tight text-slate-900">
        {a.heading}
      </h2>
      <p className="mt-1 max-w-[65ch] text-sm text-slate-600">{a.intro}</p>
      <div className={`mt-3 space-y-4 ${card}`}>
        {list.length === 0 && <p className="text-sm text-slate-600">{a.none}</p>}
        {list.length > 1 && (
          <Form method="post" className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="intent" value="transferAllCourses" />
            <div>
              <Label htmlFor={`${id}-all`}>{a.allLabel}</Label>
              <ColleagueSelect id={`${id}-all`} name="toId" options={colleagues} />
            </div>
            <label className="flex items-center gap-2 pb-2 text-sm text-slate-700">
              <input type="checkbox" name="keepAsEditor" className="size-4" />
              {a.keep}
            </label>
            <Button type="submit" size="sm" variant="secondary">
              {a.allSubmit}
            </Button>
          </Form>
        )}
        {list.map((c) => {
          const cid = `${id}-${c.id}`;
          const taken = new Set(c.members.map((m) => m.userId));
          return (
            <fieldset
              key={c.id}
              className="border-t border-slate-100 pt-4 first:border-0 first:pt-0"
            >
              <legend className="font-medium text-slate-900">{c.name}</legend>
              {c.members.length === 0 ? (
                <p className="mt-1 text-sm text-slate-600">{a.nobody}</p>
              ) : (
                <ul className="mt-1 text-sm">
                  {c.members.map((m) => (
                    <li key={m.userId} className="flex items-center justify-between gap-2 py-1">
                      <span className="text-slate-800">
                        {m.name} · {e.roles[m.role]}
                      </span>
                      <Form method="post">
                        <input type="hidden" name="intent" value="removeCourseMember" />
                        <input type="hidden" name="courseId" value={c.id} />
                        <input type="hidden" name="userId" value={m.userId} />
                        <Button
                          type="submit"
                          size="sm"
                          variant="ghost"
                          aria-label={fmt(a.removeLabel, { name: m.name, course: c.name })}
                        >
                          {e.remove}
                        </Button>
                      </Form>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
                <Form method="post" className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="intent" value="courseMember" />
                  <input type="hidden" name="courseId" value={c.id} />
                  <div>
                    <Label htmlFor={`${cid}-who`}>{a.addLabel}</Label>
                    <ColleagueSelect
                      id={`${cid}-who`}
                      name="userId"
                      options={colleagues.filter((p) => !taken.has(p.userId))}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`${cid}-role`}>{e.role}</Label>
                    <Select id={`${cid}-role`} name="role" defaultValue="editor" className="mt-1">
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {e.roles[r]}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <Button type="submit" size="sm" variant="secondary">
                    {a.add}
                  </Button>
                </Form>
                <Form method="post" className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="intent" value="transferCourse" />
                  <input type="hidden" name="courseId" value={c.id} />
                  <div>
                    <Label htmlFor={`${cid}-to`}>{a.to}</Label>
                    <ColleagueSelect id={`${cid}-to`} name="toId" options={colleagues} />
                  </div>
                  <label className="flex items-center gap-2 pb-2 text-sm text-slate-700">
                    <input type="checkbox" name="keepAsEditor" className="size-4" />
                    {a.keep}
                  </label>
                  <Button
                    type="submit"
                    size="sm"
                    variant="secondary"
                    aria-label={fmt(a.submitLabel, { course: c.name })}
                  >
                    {e.transferSubmit}
                  </Button>
                </Form>
              </div>
            </fieldset>
          );
        })}
      </div>
    </section>
  );
}
