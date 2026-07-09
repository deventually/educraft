import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useNavigation } from "react-router";
import { Check, Info, Loader2, ShieldAlert, X } from "lucide-react";
import { cn } from "~/lib/utils";
import { useT } from "~/lib/i18n/useT";

export type ToastVariant = "pending" | "success" | "error" | "info";

export interface ToastInput {
  variant: ToastVariant;
  message: string;
  /** Auto-dismiss delay; `Infinity` never auto-dismisses. Defaults by variant. */
  durationMs?: number;
}

interface ToastRecord {
  id: number;
  variant: ToastVariant;
  message: string;
  durationMs: number;
}

interface ToastContextValue {
  /** Append a toast; returns its id so a pending toast can later be updated. */
  showToast: (input: ToastInput) => number;
  /** Merge a patch into an existing toast (pending → result, in place). */
  updateToast: (id: number, patch: Partial<ToastInput>) => void;
  /** Remove a toast by id. */
  dismiss: (id: number) => void;
}

const MAX_TOASTS = 3;

/** No-auto-dismiss for pending (resolves on completion) and error (until dismissed). */
function defaultDuration(variant: ToastVariant): number {
  switch (variant) {
    case "success":
      return 4000;
    case "info":
      return 5000;
    default:
      return Number.POSITIVE_INFINITY;
  }
}

// A no-op default so `useToast()` outside a provider is a silent no-op — the
// ~dozen route-component tests that render through `createRoutesStub` without a
// provider keep working untouched.
const ToastContext = createContext<ToastContextValue>({
  showToast: () => 0,
  updateToast: () => {},
  dismiss: () => {},
});

/** Access the toast API. No-ops silently when rendered outside a `ToastProvider`. */
export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}

/**
 * Result-only bridge: fire a toast once per *new* `data` object identity
 * (`useActionData`/a fetcher returns a fresh object per submission, so this
 * re-fires per submit, not per re-render). `mapper` returning `null`, or a
 * `null`/`undefined` `data`, produces no toast. Use where there is no form
 * navigation to hang a pending toast on (e.g. fetcher widgets).
 */
export function useActionToast<T>(
  data: T | null | undefined,
  mapper: (data: T) => ToastInput | null,
): void {
  const { showToast } = useToast();
  // Read the mapper through a ref so a fresh closure never goes stale.
  const mapperRef = useRef(mapper);
  mapperRef.current = mapper;
  const seenRef = useRef<T | null | undefined>(undefined);

  useEffect(() => {
    if (data == null) return;
    if (data === seenRef.current) return; // same identity → already fired
    seenRef.current = data;
    const input = mapperRef.current(data);
    if (input) showToast(input);
  }, [data, showToast]);
}

interface FormToastOptions<T> {
  /** Map settled action data to a result toast. `null` = dismiss the pending one. */
  result: (data: T | undefined) => ToastInput | null;
  /**
   * Optional pending-toast builder, inspecting the in-flight `FormData` (e.g.
   * `formData.get("intent")` to name the action). Return `null` to suppress the
   * pending toast for this route.
   */
  pending?: (formData: FormData | undefined) => ToastInput | null;
}

/**
 * The primary route bridge: a *pending* toast the instant a `<Form>` submits,
 * updated **in place** to the mapped result once the action settles. Call it
 * **once per route** — navigation state is router-global, so a page's several
 * `<Form>`s share one hook. Drives a single effect off `useNavigation().state`
 * and reads the latest action data via a ref (populated by the time state
 * returns to `idle`).
 */
export function useFormToast<T>(data: T | undefined, options: FormToastOptions<T>): void {
  const { showToast, updateToast, dismiss } = useToast();
  const t = useT();
  const nav = useNavigation();

  const resultRef = useRef(options.result);
  resultRef.current = options.result;
  const pendingRef = useRef(options.pending);
  pendingRef.current = options.pending;
  const dataRef = useRef(data);
  dataRef.current = data;
  const savingRef = useRef(t.toast?.saving ?? "…");
  savingRef.current = t.toast?.saving ?? "…";
  const formDataRef = useRef(nav.formData);
  formDataRef.current = nav.formData;

  const pendingIdRef = useRef<number | null>(null);
  const inFlightRef = useRef(false);
  const prevStateRef = useRef(nav.state);

  useEffect(() => {
    const prev = prevStateRef.current;
    const curr = nav.state;
    prevStateRef.current = curr;

    if (curr === "submitting" && prev !== "submitting") {
      // Entering a submit → show the pending toast (unless the route suppresses).
      const custom = pendingRef.current?.(formDataRef.current);
      inFlightRef.current = true;
      if (pendingRef.current && custom == null) {
        pendingIdRef.current = null; // explicitly suppressed
      } else {
        pendingIdRef.current = showToast(
          custom ?? { variant: "pending", message: savingRef.current },
        );
      }
      return;
    }

    if (curr === "idle" && inFlightRef.current) {
      // The submit settled → resolve the pending toast into the result.
      inFlightRef.current = false;
      const r = resultRef.current(dataRef.current);
      const id = pendingIdRef.current;
      pendingIdRef.current = null;
      if (id != null) {
        // Swap pending → result in place, or dismiss it so it never hangs
        // (redirect / empty action data).
        if (r) updateToast(id, r);
        else dismiss(id);
      } else if (r) {
        showToast(r);
      }
    }
  }, [nav.state, showToast, updateToast, dismiss]);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const idRef = useRef(0);

  const showToast = useCallback((input: ToastInput): number => {
    const id = idRef.current++;
    const record: ToastRecord = {
      id,
      variant: input.variant,
      message: input.message,
      durationMs: input.durationMs ?? defaultDuration(input.variant),
    };
    setToasts((prev) => {
      const next = [...prev, record];
      // Cap the stack, dropping the oldest.
      return next.length > MAX_TOASTS ? next.slice(next.length - MAX_TOASTS) : next;
    });
    return id;
  }, []);

  const updateToast = useCallback((id: number, patch: Partial<ToastInput>) => {
    setToasts((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const variant = patch.variant ?? t.variant;
        // Explicit duration wins; a variant swap otherwise adopts the new
        // variant's default (pending's Infinity → success's 4000ms).
        const durationMs =
          patch.durationMs !== undefined
            ? patch.durationMs
            : patch.variant !== undefined
              ? defaultDuration(patch.variant)
              : t.durationMs;
        return { ...t, ...patch, variant, durationMs };
      }),
    );
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, updateToast, dismiss }}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

const variantStyles: Record<ToastVariant, string> = {
  pending: "border-slate-200 bg-white text-slate-800",
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  error: "border-red-200 bg-red-50 text-red-800",
  info: "border-slate-200 bg-white text-slate-800",
};

function VariantIcon({ variant }: { variant: ToastVariant }) {
  const className = "mt-0.5 size-4 shrink-0";
  switch (variant) {
    case "pending":
      return <Loader2 className={cn(className, "motion-safe:animate-spin")} aria-hidden />;
    case "success":
      return <Check className={className} aria-hidden />;
    case "error":
      return <ShieldAlert className={className} aria-hidden />;
    default:
      return <Info className={className} aria-hidden />;
  }
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastRecord[];
  onDismiss: (id: number) => void;
}) {
  const t = useT();
  // Region-level pause (ARIA APG): hovering or focusing the stack pauses every
  // auto-dismiss timer, resuming with the remaining time on leave/blur.
  const [paused, setPaused] = useState(false);

  if (toasts.length === 0) return null;

  return (
    // The <ol> is a labelled region, NOT a live region — each <li> owns its own
    // role + aria-live so nested live regions never double-announce.
    <ol
      aria-label={t.toast?.regionLabel ?? "Notifications"}
      tabIndex={-1}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="pointer-events-none fixed bottom-4 z-[100] flex flex-col gap-2 inset-x-0 px-4 sm:inset-x-auto sm:right-4 sm:px-0"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} paused={paused} onDismiss={onDismiss} />
      ))}
    </ol>
  );
}

function ToastItem({
  toast,
  paused,
  onDismiss,
}: {
  toast: ToastRecord;
  paused: boolean;
  onDismiss: (id: number) => void;
}) {
  const t = useT();
  const isError = toast.variant === "error";

  // Enter transition — Tailwind's motion-reduce variant keeps it accessible.
  const [shown, setShown] = useState(false);
  useEffect(() => {
    setShown(true);
  }, []);

  // Auto-dismiss with remaining-time tracking so region pause/resume is honest:
  // `elapsedRef` accumulates counted time across pauses; a duration swap
  // (pending → success) resets it so the new countdown starts from scratch.
  const elapsedRef = useRef(0);
  const runStartRef = useRef<number | null>(null);
  const lastDurationRef = useRef(toast.durationMs);
  if (lastDurationRef.current !== toast.durationMs) {
    lastDurationRef.current = toast.durationMs;
    elapsedRef.current = 0;
  }

  useEffect(() => {
    if (paused) return;
    if (!Number.isFinite(toast.durationMs)) return;
    const remaining = Math.max(0, toast.durationMs - elapsedRef.current);
    runStartRef.current = Date.now();
    const id = toast.id;
    const timer = setTimeout(() => onDismiss(id), remaining);
    return () => {
      clearTimeout(timer);
      if (runStartRef.current != null) {
        elapsedRef.current += Date.now() - runStartRef.current;
        runStartRef.current = null;
      }
    };
  }, [paused, toast.durationMs, toast.id, onDismiss]);

  return (
    // The <li> stays a semantic list item (valid <ol> structure); the card
    // inside is the per-toast live region so only the toast announces.
    <li className="pointer-events-auto">
      <div
        role={isError ? "alert" : "status"}
        aria-live={isError ? "assertive" : "polite"}
        aria-atomic="true"
        className={cn(
          "flex items-start gap-2 rounded-xl border px-3.5 py-2.5 text-sm shadow-lg sm:w-80",
          "transition duration-200 ease-out motion-reduce:transition-none",
          shown ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
          variantStyles[toast.variant],
        )}
      >
        <VariantIcon variant={toast.variant} />
        <span className="min-w-0 flex-1 break-words leading-relaxed">{toast.message}</span>
        <button
          type="button"
          aria-label={t.toast?.dismiss ?? "Dismiss notification"}
          onClick={() => onDismiss(toast.id)}
          className="-mr-1 -mt-0.5 shrink-0 rounded p-0.5 text-current/70 transition-colors hover:text-current focus:outline-none focus-visible:ring-2 focus-visible:ring-current/40"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
    </li>
  );
}
