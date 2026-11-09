import type { Tool } from "~/lib/registry/types";
import type { FormValues } from "~/lib/forms/values";
import { useT } from "~/lib/i18n/useT";
import { CoursePicker } from "../CoursePicker";
import { DynamicForm } from "../DynamicForm";
import { Button } from "../ui";

interface ChatSetupCardProps {
  tool: Tool;
  courses: { id: string; name: string }[];
  courseId: string;
  onSelectCourse: (id: string) => void;
  values: FormValues;
  onChange: (name: string, value: FormValues[string]) => void;
  onSubmit: () => void;
}

/** Sandbox gate: a focused card the user fills once before the chat opens. */
export function ChatSetupCard({
  tool,
  courses,
  courseId,
  onSelectCourse,
  values,
  onChange,
  onSubmit,
}: ChatSetupCardProps) {
  const t = useT();
  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-4">
          <h2 className="font-semibold text-slate-900">{t.chat.setupHeading}</h2>
          <p className="mt-1 text-sm text-slate-600">{t.chat.sandboxHint}</p>
        </div>
        <div className="space-y-4">
          <CoursePicker courses={courses} value={courseId} onChange={onSelectCourse} />
          <DynamicForm fields={tool.inputs} values={values} onChange={onChange} />
        </div>
        <Button onClick={onSubmit} className="mt-4">
          {t.chat.continue}
        </Button>
      </div>
    </div>
  );
}
