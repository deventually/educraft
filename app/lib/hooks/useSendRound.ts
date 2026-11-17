import { useEffect, useRef, useState } from "react";
import { useSubmit } from "react-router";
import type { PrivacyPage } from "~/lib/privacy/live";
import type { OverviewPart } from "~/lib/privacy/overview";
import type { PrivacyReviewItem } from "~/lib/streamClient";
import { usePrivacy } from "./usePrivacy";

/** What a screen holds back until Versturen: its form, the texts that go, how they go back in. */
interface Held {
  form: FormData;
  parts: OverviewPart[];
  /** The form fields the replaced texts become; by default each part's own name. */
  fields?: (values: Record<string, string>) => Record<string, string>;
}

/** An action's answer that may carry the gate's question. */
type Answer = { intent?: unknown; privacyReview?: PrivacyReviewItem[] } | null | undefined;

const newCallId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `call-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

/**
 * One screen's round without a typing moment (anonymiseerpoort step 4): `start` holds the form
 * back and opens the overview; only `send` (Versturen) posts it, with the teacher's names
 * replaced and the approval for the gate. When the gate still finds something on the server, the
 * action answers with its words: they are laid before the teacher, and the answer sends again.
 */
export function useSendRound(page: PrivacyPage | undefined, actionData: unknown, intent: string) {
  const privacy = usePrivacy(page);
  const submit = useSubmit();
  const [held, setHeld] = useState<Held | null>(null);
  const [open, setOpen] = useState(false);
  const last = useRef<Held | null>(null);

  const send = () => {
    const h = last.current;
    if (!h) return;
    const prepared = privacy.prepareOverview(h.parts);
    const fd = new FormData();
    for (const [k, v] of h.form.entries()) fd.append(k, v);
    for (const [k, v] of Object.entries(h.fields ? h.fields(prepared.values) : prepared.values))
      fd.set(k, v);
    fd.set("privacy", JSON.stringify(prepared.approval));
    // A fresh call id per send: "Stop" on leaving the page stops this one (AiLeaveGuard).
    fd.set("aiCall", newCallId());
    setOpen(false);
    submit(fd, { method: "post" });
  };

  // The gate's question for this screen: nothing went yet. The answer sends again.
  const answer = actionData as Answer;
  const { askFirst } = privacy;
  const asked = useRef<unknown>(null);
  useEffect(() => {
    if (!answer || answer === asked.current || answer.intent !== intent) return;
    asked.current = answer;
    if (answer.privacyReview?.length) askFirst(answer.privacyReview, send);
  });

  return {
    privacy,
    /** The parts of the open overview, or null when it is closed. */
    parts: open ? (held?.parts ?? null) : null,
    start: (form: FormData, parts: OverviewPart[], fields?: Held["fields"]) => {
      const h = { form, parts, ...(fields ? { fields } : {}) };
      last.current = h;
      setHeld(h);
      setOpen(true);
    },
    back: () => setOpen(false),
    send,
  };
}

export type SendRoundState = ReturnType<typeof useSendRound>;
