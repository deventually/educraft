import { useId } from "react";
import { Label, Select } from "./ui";
import { useT } from "~/lib/i18n/useT";

interface Props {
  courses: { id: string; name: string }[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}

/** Picks the course a tool's work belongs to (P20.4): it fills the course's learning
 *  outcomes into the form and links the result. Renders nothing without courses. */
export function CoursePicker({ courses, value, onChange, disabled }: Props) {
  const t = useT();
  const id = useId();
  if (courses.length === 0) return null;
  return (
    <div className="rounded-xl border border-lime-200 bg-lime-50/60 p-3">
      <Label htmlFor={id} className="mb-1.5">
        {t.tool.course}
      </Label>
      <Select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-describedby={`${id}-hint`}
      >
        <option value="">{t.tool.noCourse}</option>
        {courses.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>
      <p id={`${id}-hint`} className="mt-1.5 text-xs text-slate-600">
        {t.tool.courseHint}
      </p>
    </div>
  );
}
