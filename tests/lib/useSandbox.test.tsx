import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { InputField } from "~/lib/registry/types";
import type { ContextProfile } from "~/lib/context/types";
import { useSandbox } from "~/lib/hooks/useSandbox";

const inputs: InputField[] = [
  { name: "topic", label: { nl: "Onderwerp", en: "Topic" }, kind: "text" },
  {
    name: "level",
    label: { nl: "Niveau", en: "Level" },
    kind: "select",
    options: [
      { value: "beginner", label: { nl: "Beginner", en: "Beginner" } },
      { value: "advanced", label: { nl: "Gevorderd", en: "Advanced" } },
    ],
    // Derives the course level from the profile's study year.
    prefillFromProfile: { source: "studyYear", map: { "2": "beginner", "4": "advanced" } },
  },
];

const profiles = [
  { id: "p2", name: "Year 2", studyYear: 2 },
  { id: "p4", name: "Year 4", studyYear: 4 },
  { id: "pNo", name: "No year" },
] as ContextProfile[];

describe("useSandbox", () => {
  it("seeds values from field defaults + the default profile's prefill", () => {
    const { result } = renderHook(() => useSandbox({ inputs, profiles, defaultProfileId: "p2" }));
    expect(result.current.contextProfileId).toBe("p2");
    expect(result.current.values.topic).toBe(""); // plain default
    expect(result.current.values.level).toBe("beginner"); // derived from studyYear 2
  });

  it("re-derives prefilled fields when the profile changes, and resets when none derives", () => {
    const { result } = renderHook(() => useSandbox({ inputs, profiles, defaultProfileId: "p2" }));

    act(() => result.current.selectProfile("p4"));
    expect(result.current.contextProfileId).toBe("p4");
    expect(result.current.values.level).toBe("advanced");

    // A profile with no study year clears the stale prefill back to the field default.
    act(() => result.current.selectProfile("pNo"));
    expect(result.current.values.level).toBe("beginner");
  });

  it("updates a single field via setValue without touching the rest", () => {
    const { result } = renderHook(() => useSandbox({ inputs, profiles, defaultProfileId: "p2" }));
    act(() => result.current.setValue("topic", "photosynthesis"));
    expect(result.current.values.topic).toBe("photosynthesis");
    expect(result.current.values.level).toBe("beginner"); // untouched
  });

  describe("selectCourse (P20, 20.4)", () => {
    const courseInputs: InputField[] = [
      ...inputs,
      {
        name: "outcomes",
        label: "Leeruitkomsten",
        kind: "textarea",
        prefillFromCourse: { source: "learningOutcomes" },
      },
    ];
    const courses = [
      { id: "c1", contextProfileId: "p4", outcomes: [{ id: "o1", text: "Je test." }] },
      { id: "c2", contextProfileId: null, outcomes: [] },
    ];

    it("fills course-backed fields and selects the course's profile", () => {
      const { result } = renderHook(() =>
        useSandbox({ inputs: courseInputs, profiles, defaultProfileId: "p2", courses }),
      );
      expect(result.current.courseId).toBe("");
      act(() => result.current.selectCourse("c1"));
      expect(result.current.courseId).toBe("c1");
      expect(result.current.values.outcomes).toBe("- Je test.");
      expect(result.current.contextProfileId).toBe("p4");
      expect(result.current.values.level).toBe("advanced");
    });

    it("resets course-backed fields when switching to a course without outcomes, keeping the profile", () => {
      const { result } = renderHook(() =>
        useSandbox({ inputs: courseInputs, profiles, defaultProfileId: "p2", courses }),
      );
      act(() => result.current.selectCourse("c1"));
      act(() => result.current.selectCourse("c2"));
      expect(result.current.values.outcomes).toBe("");
      expect(result.current.contextProfileId).toBe("p4");
      act(() => result.current.selectCourse(""));
      expect(result.current.courseId).toBe("");
      expect(result.current.values.outcomes).toBe("");
    });
  });
});

describe("useSandbox — a course from the link (P27.1)", () => {
  const courseInputs: InputField[] = [
    {
      name: "outcomes",
      label: { nl: "Leeruitkomsten", en: "Outcomes" },
      kind: "textarea",
      prefillFromCourse: { source: "learningOutcomes" },
    },
  ];
  const courses = [
    { id: "c1", contextProfileId: "p4", outcomes: [{ text: "Legt fotosynthese uit" }] },
  ];

  it("starts on the initial course: its outcomes filled in and its profile selected", () => {
    const { result } = renderHook(() =>
      useSandbox({ inputs: courseInputs, profiles, courses, initialCourseId: "c1" }),
    );
    expect(result.current.courseId).toBe("c1");
    expect(result.current.values.outcomes).toBe("- Legt fotosynthese uit");
    expect(result.current.contextProfileId).toBe("p4");
  });

  it("keeps a course id it has no outcomes for, so the result is still linked", () => {
    const { result } = renderHook(() =>
      useSandbox({ inputs, profiles, defaultProfileId: "p2", initialCourseId: "c9" }),
    );
    expect(result.current.courseId).toBe("c9");
    expect(result.current.contextProfileId).toBe("p2");
  });
});
