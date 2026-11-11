---
name: accessibility-review
description: >-
  Walk a LimeOnIt screen the way a keyboard or screen reader user does and check it against
  WCAG 2.2 AA where axe cannot: keyboard and focus, menu and dialog patterns, accessible names,
  live announcements, reflow and zoom, target size, forms. Use on every PR that changes what a
  user sees, and from /release. Triggers: "accessibility", "toegankelijkheid", "a11y",
  "WCAG", "keyboard", "screen reader", "schermlezer".
---

# Accessibility review — what axe cannot see

axe already runs in every component test (`vitest-axe`) and on every key page in the browser
tests (`e2e/a11y.spec.ts`, WCAG 2.2 AA tags). Automated checks find only part of the WCAG
problems. This skill covers the rest: it **uses** the screen with a keyboard, reads what
assistive technology gets, and resizes it. Do not repeat what axe already reports.

Read `docs/fabriek/voorkeuren.md` first; it wins over this file. Talk to Bastiaan in Dutch.

## 1. Scope

- **On a PR:** the screens and components the diff changes, in both locales (`nl`, `en`).
- **From `/release`:** every screen whose components changed since the last tag
  (`git diff --name-only <tag>..origin/main -- app/components app/routes`).

## 2. Drive the real app

Use the browser tests' setup: it builds the app, seeds a teacher and an admin (with two-step
verification) and saves their signed-in state. Write a throwaway spec in `e2e/` and delete it
afterwards; never commit it unless it becomes a real test (step 4).

```ts
import { expect, test } from "@playwright/test";
import { storageStateOf } from "./users";

test.use({ storageState: storageStateOf("teacher") }); // or "admin"

test("walk /courses by keyboard", async ({ page, context }) => {
  await context.addCookies([{ name: "lang", value: "en", url: "http://localhost:4173" }]);
  await page.goto("/courses");
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press("Tab");
    const el = page.locator(":focus");
    console.log(await el.evaluate((n) => `${n.tagName} ${n.textContent?.trim().slice(0, 40)}`));
  }
  console.log(await page.locator("main").ariaSnapshot()); // names and roles, as AT gets them
});
```

```bash
npx playwright test e2e/<throwaway>.spec.ts --trace off
```

In a cloud sandbox with the pre-installed Chromium, set `PLAYWRIGHT_CHROMIUM_PATH` and also
give the setup project that `executablePath` (a temporary config that spreads
`playwright.config.ts` and sets `use.launchOptions`). Take screenshots for yourself at
`deviceScaleFactor: 1`.

## 3. What to check (WCAG 2.2 AA)

**Keyboard and focus**
- Every action works with Tab / Shift+Tab, Enter and Space; nothing needs a mouse (2.1.1).
  No keyboard trap (2.1.2).
- Focus order follows the reading order (2.4.3); after an action, focus lands somewhere
  sensible (a closed dialog returns focus to its trigger).
- Focus is always visible (2.4.7) and not hidden under the sticky header or a toast (2.4.11).
- The skip link reaches `main`.

**Patterns** (follow the WAI-ARIA Authoring Practices, prefer native HTML)
- Navigation with sub-menus: a disclosure (`button` with `aria-expanded`), not `role="menu"`.
  Escape closes it and focus returns to the button.
- Dialog: focus moves in, stays in, Escape closes, focus returns. Prefer `<dialog>`.
- Tabs: arrow keys move between tabs, Tab moves into the panel.

**Names and structure**
- Every control has a name that says what it does (4.1.2), icon-only buttons too; the visible
  label is part of the name (2.5.3).
- One `h1`, headings in order, landmarks (`header`, `nav`, `main`, `footer`) (1.3.1, 2.4.6).
- `lang` is `nl` or `en` to match the chosen locale (3.1.1); a passage in the other language
  has its own `lang` (3.1.2).

**Announcements**
- Streaming output sits in an `aria-live` region; a status message is announced without moving
  focus (4.1.3).
- Action feedback goes through the toast system (`useFormToast` / `useActionToast`) and is
  announced **once**, not also inline (`AGENTS.md`).

**Size and reflow**
- At 320 CSS pixels wide (or 400% zoom) nothing scrolls sideways except tables and code
  (1.4.10). At 200% text size nothing is cut off (1.4.4). Extra text spacing breaks nothing
  (1.4.12).
- Click targets are at least 24×24 CSS pixels, or have that much space around them (2.5.8).
- Focus rings, input borders and icons that carry meaning have 3:1 contrast (1.4.11).
- Animations respect `prefers-reduced-motion`.

**Forms**
- Every field has a label; a group of choices has `fieldset` and `legend` (1.3.1, 3.3.2).
- An error says in text what is wrong and how to fix it, and is linked to its field with
  `aria-describedby` (3.3.1, 3.3.3).
- Nobody has to type the same thing twice in one flow (3.3.7). Login and two-step verification
  allow paste and password managers (3.3.8).
- Anything you can drag can also be done with a click (2.5.7).

## 4. Fix test-first

Each finding becomes a failing test before the fix (`/tdd`): keyboard behaviour in a component
test with `userEvent.keyboard`, a whole flow in `e2e/`. A new page goes into `e2e/pages.ts`, so
axe and the CSP check run on it from then on.

## 5. Report

In the PR body (or the release PR), a short table:

| Screen | WCAG | Finding | Severity | Status |
| --- | --- | --- | --- | --- |
| `/courses` | 2.4.11 | Focus hides under the sticky header | high | fixed, test added |

Say honestly what you did **not** check. A sandbox has no real screen reader: write "niet
getest met NVDA of VoiceOver". Before schools use LimeOnIt, a human audit with assistive
technology users is still needed, also for the accessibility statement
(toegankelijkheidsverklaring); that is Bastiaan's call.
