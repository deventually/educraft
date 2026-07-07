# Phase 16 — Flash toasts across redirects (STUB / deferred)

> **Status:** ⚪ stub — deferred out of [P15](P15-user-feedback-toasts-a11y.md). This file records the
> intent so the follow-on can be picked up cold. Not scoped or scheduled yet. **Depends on P15**
> (the toast provider + `useToast`/viewport must exist first). Branch from `main`.

## Why this exists

[P15](P15-user-feedback-toasts-a11y.md) gives every **data-returning** action a pending→result toast,
but a client-side **redirect** discards `actionData`, so redirecting flows show nothing on arrival:

- `login` → redirects to `/tools`
- `invite/:token` (redeem) → redirects to the app
- `reset/:token` → redirects to `/login`
- (any future action that `redirect(...)`s instead of returning data)

P15 deferred this deliberately: those landings already communicate success implicitly (you *are* on the
tools page; you *are* logged in), so the value is lower and the mechanism is heavier (it touches the
server session layer and the root loader). This stub captures the design for when it's wanted.

## Sketch (not final)

1. **Flash helper (server).** A one-shot message stored in the session cookie — `setFlash(session, { variant, message })`
   on the way out of an action; `takeFlash(session)` reads **and clears** it. Reuse the existing
   session/cookie infra (`app/server/*` — the same layer that holds auth + `sessionVersion` + locale).
   Keep the payload tiny (`{ variant: "success"|"error"|"info", key }`) and prefer a **message key**
   resolved client-side via `useT()` over shipping raw copy through the cookie (keeps i18n server-neutral).
2. **Root loader reads it.** `app/root.tsx` `loader` calls `takeFlash` and returns the (cleared) flash;
   because it's cleared on read, a refresh won't re-toast.
3. **Provider drains it.** A small effect in / near `ToastProvider` (or a `useFlashToast()` reading the
   root loader data) calls `showToast` once per distinct flash on mount/navigation.
4. **Actions opt in.** `login`/`invite`/`reset` (and any redirecting action) set the flash before
   `redirect(...)`.

## Test plan (when built)

- `tests/server/flash.test.ts` — `setFlash` then `takeFlash` returns it once, then `null` (cleared);
  survives a round-trip through the cookie header.
- `tests/lib/useFlashToast.test.tsx` — a root loader returning a flash → exactly one toast on mount;
  no flash → none; a second render without a new flash → no duplicate.
- Route-level: an action that sets a flash + `redirect`s → the destination shows the toast (stub route
  technique from P15's `toastWiring.test.tsx`).

## Out of scope

- Anything already delivered by P15 (data-returning action toasts, the provider/viewport, nav a11y).
- Multi-message flash queues — one flash per redirect is enough.
