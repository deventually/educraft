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
    expect(result.current.locked).toBe(false);
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

  it("locked (provisioned-student) mode prefills from lockedValues and reports locked", () => {
    const { result } = renderHook(() =>
      useSandbox({ inputs, lockedValues: { topic: "fixed by teacher" } }),
    );
    expect(result.current.locked).toBe(true);
    expect(result.current.values.topic).toBe("fixed by teacher");
    // Non-locked fields still get their normal defaults.
    expect(result.current.values.level).toBe("beginner");
  });
});
