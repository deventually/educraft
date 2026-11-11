import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useBlocker, useNavigation } from "react-router";
import { useT } from "~/lib/i18n/useT";
import { Button } from "./ui";

/** What the guard does with running AI work when the teacher leaves the page. */
export interface AiWork {
  /** "Stop": stop the model call now. */
  abort: () => void;
  /** "Keep running": let it finish after the page is gone (and save its result). */
  keep: () => void;
}

type Register = (work: { current: AiWork }) => () => void;
const AiWorkContext = createContext<Register | null>(null);

/**
 * Marks AI work as running while `busy`. Leaving the page then asks the teacher whether to
 * keep it running or stop it. Without an `AiLeaveGuard` above it, this does nothing.
 */
export function useAiWork(busy: boolean, work: AiWork): void {
  const register = useContext(AiWorkContext);
  const latest = useRef(work);
  latest.current = work;
  useEffect(() => {
    if (!busy || !register) return;
    return register(latest);
  }, [busy, register]);
}

/**
 * The call id of an AI action without streaming: put it in the action's form. While the
 * form is being submitted, leaving asks first, and "Stop" stops it on the server.
 */
export function AiCallField() {
  const [id, setId] = useState("");
  const idle = useNavigation().state === "idle";
  // A fresh id per submission, made in the browser only (no hydration mismatch).
  useEffect(() => {
    if (idle) setId(crypto.randomUUID());
  }, [idle]);
  return <input type="hidden" name="aiCall" value={id} />;
}

function cancelOnServer(callId: string) {
  void fetch("/api/ai-cancel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callId }),
    keepalive: true,
  }).catch(() => {});
}

/**
 * One guard for the whole app: leaving a page while a tool streams, a chat answers or an
 * AI action runs shows a dialog with "Keep running", "Stop" and "Stay on this page".
 * Closing the tab still stops a stream (the browser offers no choice there).
 */
export function AiLeaveGuard({ children }: { children: React.ReactNode }) {
  const running = useRef(new Set<{ current: AiWork }>());
  const register = useCallback<Register>((work) => {
    running.current.add(work);
    return () => {
      running.current.delete(work);
    };
  }, []);

  // An AI action without streaming is running while its form is being submitted.
  const navigation = useNavigation();
  const submittedCall =
    navigation.state === "submitting" ? navigation.formData?.get("aiCall") : null;
  const callId = typeof submittedCall === "string" && submittedCall ? submittedCall : null;
  const callRef = useRef(callId);
  callRef.current = callId;

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      (running.current.size > 0 || callRef.current !== null) &&
      currentLocation.pathname !== nextLocation.pathname,
  );

  const leave = (choice: keyof AiWork) => {
    if (blocker.state !== "blocked") return;
    for (const work of running.current) work.current[choice]();
    if (choice === "abort" && callRef.current) cancelOnServer(callRef.current);
    blocker.proceed();
  };

  const value = useMemo(() => register, [register]);
  return (
    <AiWorkContext.Provider value={value}>
      {children}
      {blocker.state === "blocked" && (
        <LeaveDialog
          onKeep={() => leave("keep")}
          onAbort={() => leave("abort")}
          onStay={() => blocker.reset()}
        />
      )}
    </AiWorkContext.Provider>
  );
}

function LeaveDialog({
  onKeep,
  onAbort,
  onStay,
}: {
  onKeep: () => void;
  onAbort: () => void;
  onStay: () => void;
}) {
  const t = useT().aiLeave;
  const titleId = useId();
  const bodyId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus moves in on open and goes back where it was when the teacher stays.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    return () => {
      if (before?.isConnected) before.focus();
    };
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onStay();
      return;
    }
    if (e.key !== "Tab") return;
    const buttons = dialogRef.current?.querySelectorAll<HTMLElement>("button");
    const first = buttons?.[0];
    const last = buttons?.[buttons.length - 1];
    if (!first || !last) return;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40" aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        onKeyDown={onKeyDown}
        className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
      >
        <h2 id={titleId} className="text-lg font-semibold text-slate-900">
          {t.title}
        </h2>
        <p id={bodyId} className="mt-2 text-sm text-slate-600">
          {t.body}
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onStay}>
            {t.stay}
          </Button>
          <Button type="button" variant="danger" onClick={onAbort}>
            {t.abort}
          </Button>
          <Button type="button" variant="primary" onClick={onKeep} data-autofocus>
            {t.keep}
          </Button>
        </div>
      </div>
    </div>
  );
}
