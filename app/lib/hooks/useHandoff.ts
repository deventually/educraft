import { useEffect, useRef } from "react";
import { takeHandoff } from "~/lib/forms/handoff";
import type { FormValues } from "~/lib/forms/values";
import type { Tool } from "~/lib/registry/types";

/**
 * A utility may hand over values ("Laat uitleggen", P24.5). Taken once per tool, after
 * mount, so the server render and hydration agree; only the tool's own text fields are filled.
 */
export function useHandoff(
  tool: Pick<Tool, "slug" | "inputs">,
  setValue: (name: string, value: FormValues[string]) => void,
): void {
  const { slug } = tool;
  const latest = useRef({ inputs: tool.inputs, setValue });
  latest.current = { inputs: tool.inputs, setValue };
  useEffect(() => {
    const handed = takeHandoff(slug);
    if (!handed) return;
    for (const field of latest.current.inputs) {
      const value = handed[field.name];
      if (value !== undefined && (field.kind === "text" || field.kind === "textarea")) {
        latest.current.setValue(field.name, value);
      }
    }
  }, [slug]);
}
