import { useEffect } from "react";
import { useSubmit } from "react-router";
import type { DesignStep } from "~/lib/courses/wizard";

type ApplyResult = { ok: boolean; intent?: string; next?: DesignStep } | undefined;

/**
 * The course wizard runs on: when an apply answers with a `next` step (`nextDesignStep` on the
 * server), the page asks for that step's proposal right away, as if the teacher pressed its
 * button. It goes as a normal AI action with its own call id, so the pending toast shows and
 * leaving the page can still stop it. Once per answer: a re-render does not ask again.
 */
export function useDesignChain(result: ApplyResult): void {
  const submit = useSubmit();
  useEffect(() => {
    if (!result?.ok || result.intent !== "import-apply" || !result.next) return;
    void submit({ intent: result.next, aiCall: crypto.randomUUID() }, { method: "post" });
  }, [result, submit]);
}
