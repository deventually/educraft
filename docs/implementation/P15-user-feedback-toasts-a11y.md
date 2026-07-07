# Phase 15 — Immediate action feedback (toasts) + navigation a11y

> **How to run this brief:** open it in a fresh session and implement it exactly, test-first per
> `AGENTS.md` / the `/tdd` skill. Do the internal phases in order (15.0 → 15.4); gate each with
> `npm test && npm run typecheck && npm run check` before moving on, and commit the phase. **No
> dependencies** — pure client/UI + i18n, no schema/migration. Branch from `main`.

## Context & goal

After a user triggers an action — typically clicking **Save** at the *bottom* of a long form — the
current feedback (a `<p role="status">Opgeslagen.</p>` rendered at the **top** of the form, e.g.
`admin.context.tsx:434`, `account.tsx:119`, `cohorts.$id.tsx:321`) is off-screen and invisible to
the user who just clicked. Several routes give **no** feedback at all on mutation (`admin.cohorts.tsx`
delete/assign/reassign/remove; `projects._index.tsx` delete). Screen-reader users additionally get
**no announcement** when a client-side navigation changes the page, and there is **no skip link**
(AGENTS.md lists one as an a11y rule, but none exists — confirmed by grep).

**Goal:** a global, accessible **toast/snackbar** system that surfaces action feedback where the user
is looking — showing a *pending* "Bezig…/Saving…" toast the instant they submit, which then **updates
in place** to a success/error result — plus three missing navigation-a11y primitives (skip link,
route-change announcer, focus-on-navigation) so the whole feedback layer is sound for keyboard and
screen-reader users.

## Decisions (user-confirmed)

1. **Pending → result toasts.** On submit, show a pending toast immediately; on completion it
   **updates by id** into success/error (not a second toast). Requires `showToast` to return an id +
   an `updateToast(id, …)` API.
2. **Position: bottom-right** (full-width along the bottom on mobile) — nearest the action buttons
   that sit at a form's bottom, which is the exact spot the "message at the top" bug hides.
3. **Scope: all ~9 action routes** — consistent feedback everywhere: `admin.tools`, `admin.context`,
   `admin.models`, `admin.invites`, `admin.cohorts`, `cohorts.$id`, `account`, `projects._index`,
   `context-profiles`.
4. **Also ship navigation a11y:** skip link, route-change announcer, focus-to-main on navigation.
5. **`useToast()` no-ops without a provider** (via a no-op `createContext` default), so the ~dozen
   existing route-component tests that render routes through `createRoutesStub` **without** the
   provider keep passing untouched.
6. **Flash-across-redirect is deferred** (see Out of scope / follow-on [P16](P16-flash-toasts-across-redirect.md)) —
   few in-app actions redirect, and the ones that do (login→tools, invite→home) land on a page that
   already signals success.

## 15.0 — Persist this brief (house convention)

Per the project's "plans as implementation briefs" convention:
- Save this file verbatim as **`docs/implementation/P15-user-feedback-toasts-a11y.md`**.
- Add a **P15 row** to `docs/implementation/README.md` (P-series table): scope = "Immediate action
  feedback (pending→result toasts, bottom-right, all action routes) + navigation a11y (skip link,
  route-change announcer, focus-on-nav)"; Depends on = "—"; State = 🟨 until shipped.
- Add a **deferred follow-on stub** ([P16](P16-flash-toasts-across-redirect.md) + README row) for
  **flash-across-redirect toasts** (server one-shot cookie → root loader reads+clears → toast on
  arrival), covering login/invite/reset landings.

## 15.1 — Toast core: `app/components/Toast.tsx` (NEW)

One module exports `ToastProvider`, `useToast`, the bridge hooks (15.2), and the
`ToastInput`/`ToastVariant` types. Mirrors the house component idiom (`cn()`, `lucide-react` icons,
`useT()` for copy — see `ConfirmDialog.tsx`, `AiNotice.tsx`).

- **Context + non-throwing fallback.** `createContext` gets a **no-op default** (`{ showToast, updateToast, dismiss }` all no-ops) so `useToast()` outside a provider is a silent no-op (Decision 5). `useToast()` = `useContext(ToastContext)`.
- **Variants:** `"pending" | "success" | "error" | "info"`.
  - `pending`: spinner icon (`Loader2` with `motion-safe:animate-spin` / reuse `Spinner`), `durationMs: Infinity` (no auto-dismiss — it resolves when the action returns), polite.
  - `success`: `Check`, emerald box (`border-emerald-200 bg-emerald-50 text-emerald-900`), ~4000 ms, `role="status"`/`aria-live="polite"`.
  - `error`: `ShieldAlert`, red box (`border-red-200 bg-red-50 text-red-800`), `durationMs: Infinity` (until dismissed), `role="alert"`/`aria-live="assertive"`.
  - `info`: `Info`, neutral, ~5000 ms, polite.
- **Provider state:** a `ToastRecord[]` (`{ id, variant, message, durationMs }`), a monotonic `idRef`.
  - `showToast(input): number` — append, cap at **MAX_TOASTS = 3** (drop oldest), **return the id**.
  - `updateToast(id, patch)` — merge patch into the record (used by pending→result to swap variant/message/duration in place). No-op if the id is gone (already dismissed).
  - `dismiss(id)` — filter it out.
- **Viewport (`<ol>`), a11y DOM decision:** the `<ol>` is a **labelled region but NOT itself a live region** (`aria-label={t.toast.regionLabel}`, `tabIndex={-1}`, no `aria-live`). **Each `<li>` toast carries its own `role` + `aria-live` + `aria-atomic="true"`** — avoids the double-announce of a live `<ol>` wrapping live `<li>`s. Positioned **bottom-right**: `fixed bottom-4 z-[100] … inset-x-0 px-4 sm:inset-x-auto sm:right-4 sm:px-0`, `flex flex-col gap-2`, newest appended last (nearest the bottom). `pointer-events-none` on the `<ol>`, `pointer-events-auto` per `<li>` so gaps don't block clicks. Renders `null` when empty.
- **Toast item:** icon + message + close `<button aria-label={t.toast.dismiss}>` (`X`). Auto-dismiss timer honours `durationMs` (`Infinity` = none); **region-level pause-on-hover/focus** (per ARIA APG — `onMouseEnter/Leave` + `onFocus/Blur` on the `<ol>` pause **all** timers, resuming with remaining time). Enter transition via a `shown` state toggled on mount with `transition … motion-reduce:transition-none` (reduced-motion safe; no custom CSS/`@keyframes` — use Tailwind's `motion-reduce:` variant). Toasts **never steal focus** (announced via live region; close button is tab-reachable).
- **i18n (both `nl.ts` + `en.ts`, in lockstep — `tests/i18n.test.ts` enforces parity):** new top-level `toast` block: `regionLabel` ("Meldingen"/"Notifications"), `dismiss` ("Melding sluiten"/"Dismiss notification"), and the shared pending label `saving` ("Bezig…"/"Working…").
- **Test plan (RED) — `tests/components/Toast.test.tsx` (happy-dom).** Mirror `ConfirmDialog.test.tsx` (render/screen, `userEvent`, `axe` with `axeOpts = { rules: { "color-contrast": { enabled: false } } }`, `createRoutesStub` so `useT()` resolves → falls back to `nl`). A `Harness` renders buttons calling `useToast()`:
  1. empty → no `role="status"`/`"alert"`, no region;
  2. success → `role="status"` + `aria-live="polite"` + message;
  3. error → `role="alert"` + `aria-live="assertive"`; advancing timers 30 s → still present (no auto-dismiss);
  4. success auto-dismisses at 4000 ms (`vi.useFakeTimers()`, `userEvent.setup({ advanceTimers: vi.advanceTimersByTime })`, `vi.useRealTimers()` in cleanup);
  5. close button removes it;
  6. pause-on-hover: `user.hover(region)` → advance 4000 ms → still present; `unhover` → advance → gone;
  7. `updateToast`: show a pending toast, call `updateToast(id, {variant:"success", …})` → same single toast now shows success text/role (proves in-place swap, stack length stays 1);
  8. max-stack: fire 4 → exactly 3 rendered, oldest message absent;
  9. localized dismiss label resolves (`getByRole("button", { name: "Melding sluiten" })`);
  10. axe zero-violations with an active success + error toast.

## 15.2 — Bridge hooks (in `app/components/Toast.tsx`)

Two hooks — a result-only primitive and the navigation-aware pending→result hook.

- **`useActionToast(data, mapper)`** (result-only primitive; used by fetch widgets / any place without a form navigation). Fires once per new `data` **object identity** (`useActionData`/fetcher return a fresh object per submission → "re-fire per submit, not per re-render"). `null` mapping = no toast; `data == null` = no toast. `mapper` read via a ref to avoid stale closures.
- **`useFormToast(data, { result, pending? })`** — the primary route hook. Internally calls `useNavigation()`. **One call per route** (nav state is router-global; a page's several `<Form>`s share it). Drive a single effect off `nav.state` transitions, reading the latest `data` (actionData) via a ref (actionData is populated by the time `nav.state` returns to `idle`):
  - on entering **`submitting`**: `id = showToast(pending(nav.formData) ?? {variant:"pending", message: t.toast.saving})`. `pending` may inspect `nav.formData.get("intent")` to name the action ("Verwijderen…", "Opslaan…"); return `null` to suppress.
  - on returning to **`idle`** after a submit: `const r = result(dataRef.current)`. If a pending id exists: `r ? updateToast(id, {...r, durationMs default}) : dismiss(id)` (the **dismiss-on-no-result** branch covers a redirect/empty-actionData action so the pending toast never hangs). Else if `r`: `showToast(r)`.
- **Test plan (RED) — `tests/lib/useActionToast.test.tsx`** (MUST be `.test.tsx` — needs React+DOM). Use a `renderWithToasts(ui)` helper (`createRoutesStub` route whose `Component` wraps `ui` in `ToastProvider`). `useActionToast`: initial `undefined` → none; `{ok:"email"}` → success toast; `null`-mapping (`{ok:false}`) → none; new same-shape object → 2nd toast (per-submit re-fire); same reference re-render → still 1.
- **Test plan (RED) — `tests/lib/useFormToast.test.tsx`** — a stub route with an inline `action` and a `<Form>`; assert: on submit a **pending** toast (`t.toast.saving`) appears, and after the action resolves it **updates in place** to success (`role="status"`, still one toast); an `action` returning an error shape → the pending toast becomes `role="alert"`; an `action` returning `null`/redirect → the pending toast is dismissed (none left).

## 15.3 — Mount app-wide + wire all action routes

- **Mount (`app/root.tsx`):** wrap `App()`'s `<Outlet/>` in `<ToastProvider>` (App wraps **every** route incl. the auth routes outside `AppShell`, and sits above every `Form`/action). `Layout()` untouched — the viewport renders inside `App` → inside `<body>`, with the root loader context `useT()` needs.

  ```tsx
  export default function App() {
    return (
      <ToastProvider>
        <Outlet />
      </ToastProvider>
    );
  }
  ```

- **Wire each of the ~9 action routes** with **one `useFormToast(actionData, { result, pending? })`** whose `result` mapper covers that route's shapes (see the shapes below). Routes with no `useActionData` today (`admin.cohorts.tsx`, `projects._index.tsx`) add `const actionData = useActionData<typeof action>()`. Representative:

  ```tsx
  // account.tsx (existing actionData)
  useFormToast(actionData, {
    result: (d) =>
      "error" in d && d.error ? { variant: "error", message: d.error }
      : d.ok === "email" ? { variant: "success", message: t.account.emailSaved }
      : d.ok === "password" ? { variant: "success", message: t.account.passwordSaved }
      : null,
  });
  ```

  Result shapes per route (from exploration): `admin.tools` `{savedSlug,enabled}|{error}`; `admin.context` `{saved}|{error:"instance-empty"}`; `admin.models` `{saved}|{error}`; `admin.invites` `{link|revoked|roleChanged|resetLink|emailSet}|{error:key}`; `admin.cohorts` `{deleted|assigned|reassigned|removed}|{error}`; `cohorts.$id` `{saved}|{cohortId,links}|{error:string}`; `account` `{ok:"email"|"password"}|{error}`; `projects._index` `{ok:boolean}`; `context-profiles` `{ok:boolean, error?}`.
- **New i18n keys** for the routes that had no message (both bundles): under `admin.cohorts` → `toastDeleted/toastAssigned/toastReassigned/toastRemoved/toastError`; under `projects` → `toastDeleted`. Everything else **reuses** existing strings (`admin.console.saved`, `account.emailSaved/passwordSaved`, `cohorts.saved`, and the server-returned localized `error` strings).
- **Double-announcement dedupe (a11y):** a wired route must not *also* announce the same event inline. **Rule:** on every wired route, strip `role="status"`/`role="alert"`/`aria-live` from the transient inline confirmation so only the toast announces.
  - Remove the transient inline "Opgeslagen."/"Saved."/success `<p role="status|aria-live>` blocks entirely where the toast fully replaces them (`account.tsx` success blocks; `admin.tools/context/models` `aria-live` "saved" lines; `cohorts.$id` success `role="status"`).
  - For inline **errors** kept visible near the field, keep the red text but drop `role="alert"`.
  - **Keep** any block that shows *persistent content* (generated invite **links** in `admin.invites` / `cohorts.$id`) — that's content, not a status; leave it intact.
- **Test plan (RED) — `tests/routes/toastWiring.test.tsx`.** Do **not** import real route modules (they pull `~/server/*` repos). Build **stub routes** whose `Component` mirrors the wiring + inline `action` returning the shape (the `ConfirmDialog.test.tsx` technique): a projects-style delete `<Form>` (`action:()=>({ok:true})`) → success toast; an admin.cohorts-style assign `<Form>` (`action:()=>({assigned:true})`) → success; a variant (`action:()=>({error:true})`) → `role="alert"` toast.

## 15.4 — Navigation a11y: skip link, announcer, focus-on-nav

Add the three missing SPA-navigation primitives (all in `app/components/AppShell.tsx`, the chrome that owns `<main id="top">`; auth routes have no nav to skip):

- **Skip link:** first focusable element in AppShell's tree (before `<header>`): an `<a href="#top">` styled `sr-only focus:not-sr-only` (absolute, visible box on focus, `bg-white`/`ring`). Add `tabIndex={-1}` to `<main id="top">` so the anchor moves focus into it. i18n `nav.skipToContent` ("Naar hoofdinhoud"/"Skip to main content").
- **Route-change announcer:** a small `RouteAnnouncer` (in AppShell) rendering an **always-mounted** visually-hidden `<div role="status" aria-live="polite" aria-atomic="true" className="sr-only">`. On `useLocation().pathname` change (skip initial mount), set its text to `document.title` after a `requestAnimationFrame`/`setTimeout(0)` (title is set by RR meta post-navigation). This makes SPA navigations audible to screen readers.
- **Focus-on-navigation:** on `pathname` change (skip initial mount), move focus to the `<main id="top" tabIndex={-1}>` via a ref, so keyboard/SR users restart at the top of the new page. Complements (does not conflict with) the announcer: focusing the `<main>` landmark doesn't read the title, so the polite region still delivers it.
- **i18n:** `nav.skipToContent` (both bundles).
- **Test plan (RED) — `tests/components/AppShell.test.tsx` (extend the existing file).** Render AppShell via `createRoutesStub` with ≥2 child routes: skip link present as first focusable + targets `#top` (+ axe zero-violations); after navigating between children, the announcer `role="status"` text updates and `document.activeElement` is the `<main>` (assert focus moved); initial mount does **not** announce/steal focus.
- **Docs:** update `AGENTS.md` §3 Accessibility-by-Design — the skip link now genuinely exists; note the toast live-region + route-change announcer as the standard feedback/announce layer.

## Out of scope (respect — do not gold-plate)

- **Flash-across-redirect** toasts (server one-shot cookie) — deferred follow-on
  ([P16](P16-flash-toasts-across-redirect.md), 15.0 stub). Redirect landings already communicate success.
- **Button-level pending spinners** (disable + inline spinner on the submit button) — the pending
  toast covers "what's happening"; per-button states are a separate, optional polish.
- **Converting `<Form>` flows to `useFetcher`** for per-form isolation — not needed; the one-hook-per-route
  model handles multi-form pages. (If a fetcher flow arrives later, add a `useFetcherToast(fetcher, …)`
  sibling that reads `fetcher.state`/`fetcher.data`.)
- **Toasts for client-fetch widgets** (`FeedbackWidget`, `SessionHelpfulness`) — they have their own
  inline feedback; leave as-is.
- No new dependencies (no toast library), no schema/migration, no engine changes.

## Verification

- **Gate:** `npm test && npm run typecheck && npm run check` green after each sub-phase and at the end
  (incl. `tests/i18n.test.ts` parity and every `vitest-axe` assertion).
- **Manual (via `/run` or the browser MCP):** on `/account`, scroll to the bottom Save, submit → a
  **"Bezig…"** toast appears bottom-right and updates to **"E-mailadres bijgewerkt."**; a wrong
  password → an **error** toast (persists until dismissed). On `/projects` delete → **"Resultaat
  verwijderd."** (was silent). Tab from a cold page load → the **skip link** appears and jumps to the
  content. With a screen reader (or by asserting the live region), navigating between pages announces
  the new page title. Verify `prefers-reduced-motion` disables the toast slide.

## Critical files

- **NEW** `app/components/Toast.tsx` — provider, `useToast` (no-op fallback), `updateToast`, viewport,
  item, `useActionToast`, `useFormToast`.
- `app/root.tsx` — mount `ToastProvider` around `App()`'s `<Outlet/>`.
- `app/components/AppShell.tsx` — skip link, `RouteAnnouncer`, focus-to-main, `<main tabIndex={-1}>`.
- `app/lib/i18n/messages/nl.ts` + `en.ts` — `toast.*`, `nav.skipToContent`, `admin.cohorts.toast*`,
  `projects.toastDeleted` (lockstep).
- The ~9 action routes: `admin.tools.tsx`, `admin.context.tsx`, `admin.models.tsx`, `admin.invites.tsx`,
  `admin.cohorts.tsx`, `cohorts.$id.tsx`, `account.tsx`, `projects._index.tsx`, `context-profiles.tsx`
  (add `useFormToast`; strip redundant inline live semantics).
- **NEW tests** `tests/components/Toast.test.tsx`, `tests/lib/useActionToast.test.tsx`,
  `tests/lib/useFormToast.test.tsx`, `tests/routes/toastWiring.test.tsx`; **extend**
  `tests/components/AppShell.test.tsx`.
- **Docs:** `docs/implementation/P15-user-feedback-toasts-a11y.md` (this brief), `docs/implementation/README.md`
  (P15 row + flash follow-on stub), `AGENTS.md` §3.
