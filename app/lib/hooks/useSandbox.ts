import { useState } from "react";
import type { InputField } from "~/lib/registry/types";
import type { ContextProfile } from "~/lib/context/types";
import {
  coursePrefillValues,
  type CoursePrefillSource,
  defaultValuesFor,
  profilePrefillValues,
  type FormValues,
} from "~/lib/forms/values";

/** A course as the tool page sees it (P20, 20.4). */
export interface SandboxCourse extends CoursePrefillSource {
  id: string;
  contextProfileId: string | null;
}

export interface UseSandboxOptions {
  /** The tool's input fields — the sandbox seeds one value per field. */
  inputs: InputField[];
  /** Selectable teaching-context profiles (empty/omitted → no profile prefill). */
  profiles?: ContextProfile[];
  /** Which profile is selected initially. */
  defaultProfileId?: string;
  /** The teacher's courses (empty/omitted → no course prefill). */
  courses?: SandboxCourse[];
  /**
   * The course to start on (P27.1, a next step opened with `?course=`). Its outcomes are
   * filled in and its profile selected when it is in `courses`; otherwise the id is kept
   * only so the result is still linked to it.
   */
  initialCourseId?: string;
  /**
   * The course item the tool was opened for (P27.4, `?item=`). It stays only while the
   * initial course stays selected; picking a course drops it.
   */
  initialItemId?: string;
}

export interface UseSandbox {
  /** Current form values, keyed by input name. */
  values: FormValues;
  /** Update a single field. */
  setValue: (name: string, value: FormValues[string]) => void;
  /** Escape hatch for callers that need the raw setter (functional updates). */
  setValues: React.Dispatch<React.SetStateAction<FormValues>>;
  /** The selected context profile id ("" = no profile). */
  contextProfileId: string;
  /** Select a profile and re-derive its profile-backed fields. */
  selectProfile: (id: string) => void;
  /** The selected course id ("" = no course). */
  courseId: string;
  /**
   * Select a course: re-derive its course-backed fields (reset when it derives
   * nothing) and, when the course has a context profile, select that profile too.
   */
  selectCourse: (id: string) => void;
  /** The course item the result is linked to ("" = the course as a whole). */
  itemId: string;
}

/**
 * The shared sandbox: the per-tool input values plus the selected context
 * profile, with one behaviour the three tool surfaces used to each re-implement:
 *
 *  - **profile prefill** — a field marked `prefillFromProfile` is seeded from the
 *    selected profile and re-derived when the profile changes (GeneratorView,
 *    StageStepper). Switching to a profile that derives nothing resets the field
 *    to its default, so a stale prefill never lingers.
 *
 * A tool with no `prefillFromProfile` fields (e.g. Cognitive Architect) behaves
 * exactly as before: `selectProfile` only touches profile-backed fields.
 */
export function useSandbox({
  inputs,
  profiles,
  defaultProfileId = "",
  courses,
  initialCourseId = "",
  initialItemId = "",
}: UseSandboxOptions): UseSandbox {
  const profileList = profiles ?? [];
  const initialCourse = (courses ?? []).find((c) => c.id === initialCourseId);
  const startProfileId =
    initialCourse?.contextProfileId &&
    profileList.some((p) => p.id === initialCourse.contextProfileId)
      ? initialCourse.contextProfileId
      : defaultProfileId;
  const [courseId, setCourseId] = useState(initialCourseId);
  const [itemId, setItemId] = useState(initialCourseId ? initialItemId : "");
  const [contextProfileId, setContextProfileId] = useState(startProfileId);
  const [values, setValues] = useState<FormValues>(() => ({
    ...defaultValuesFor(inputs),
    ...profilePrefillValues(
      inputs,
      profileList.find((p) => p.id === startProfileId),
    ),
    ...coursePrefillValues(inputs, initialCourse),
  }));

  function selectProfile(id: string) {
    setContextProfileId(id);
    const prefill = profilePrefillValues(
      inputs,
      profileList.find((p) => p.id === id),
    );
    setValues((prev) => {
      const next = { ...prev };
      for (const f of inputs) {
        if (!f.prefillFromProfile) continue;
        next[f.name] = f.name in prefill ? prefill[f.name] : defaultValuesFor([f])[f.name];
      }
      return next;
    });
  }

  function selectCourse(id: string) {
    setCourseId(id);
    setItemId("");
    const course = (courses ?? []).find((c) => c.id === id);
    const prefill = coursePrefillValues(inputs, course);
    setValues((prev) => {
      const next = { ...prev };
      for (const f of inputs) {
        if (!f.prefillFromCourse) continue;
        next[f.name] = f.name in prefill ? prefill[f.name] : defaultValuesFor([f])[f.name];
      }
      return next;
    });
    if (course?.contextProfileId && profileList.some((p) => p.id === course.contextProfileId))
      selectProfile(course.contextProfileId);
  }

  const setValue = (name: string, value: FormValues[string]) =>
    setValues((prev) => ({ ...prev, [name]: value }));

  return {
    values,
    setValue,
    setValues,
    contextProfileId,
    selectProfile,
    courseId,
    selectCourse,
    itemId,
  };
}
