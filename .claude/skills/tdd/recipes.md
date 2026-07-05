# Recipes — repo-accurate templates

Every snippet here matches the **real** shapes in the codebase (verified against
`app/lib/registry/types.ts`, `buildSystemPrompt.ts`, and the existing tests). Read
`quality.md` first so the tests you copy stay behaviour-focused, not tautological.

> **Stale forms to avoid** (they don't exist in this codebase, but tend to show up from
> memory or older examples): `buildSystemPrompt(tool, inputs)`, `tool.title`, a per-tool
> `<Id>ChatView` component. Use the forms below instead.

## Covered for free by the global suites

A new tool is automatically exercised by suites that iterate **all** tools — so your
per-tool test only needs to add the tool-*specific* delta. Don't re-assert what these
already guarantee:

- **`tests/registry.test.ts`** — `validateTools(ALL_TOOLS)` clean, **unique slugs**,
  every `mode: "chat"` tool has a `chat` config, every tool declares a positive
  `maxTokens` budget.
- **`tests/prompts.test.ts`** — every prompt has non-empty `runtime.nl` + `runtime.en` +
  `verbatim`, **nl and en share an identical placeholder set**, and no leftover
  `{{outputLanguage}}`.
- **`tests/i18n.test.ts`** — `messages.nl` / `messages.en` have identical key sets (only
  relevant if you add UI message keys).
- **`tests/chatGreeting.test.ts`** — chat greeting/starter scaffolding across tools.

**Not free — an extra registration you must do:** `tests/goals.test.ts` iterates
`getEnabledTools()` and requires every *enabled* tool to be filed in
`app/lib/registry/goals.ts` — a `TOOL_GOALS[slug]` entry (a goal whose `audience` matches
the tool's `userType`) and a non-empty `TOOL_KEYWORDS[slug]` list. It's the one step that's
easy to miss; skip it and the gate goes red (see step **f** below).

Your per-tool test's real job: **it resolves by slug**, **its prompt fills with no
unresolved `{{…}}` given realistic inputs and contains the right anchor**, and **required
fields exist**.

---

## Recipe: add a generator tool (one-shot / multi-stage)

### 1. RED — `tests/tools/<slug>.test.ts` (node env, `*.test.ts`)

```ts
import { describe, it, expect } from "vitest";
import { getToolBySlug } from "~/lib/registry";
import { buildSystemPrompt } from "~/lib/template/buildSystemPrompt";

describe("tool: <slug>", () => {
  it("registers and resolves by slug", () => {
    const tool = getToolBySlug("<slug>");
    expect(tool).toBeDefined();
    expect(tool?.id).toBe("<slug>");
  });

  it("builds a prompt with no unresolved placeholders", () => {
    const tool = getToolBySlug("<slug>")!;
    // A realistic value for every REQUIRED input (keys = InputField.name):
    const values = { fieldOne: "example text", fieldTwo: "another" };

    const prompt = buildSystemPrompt({
      promptId: tool.stages[0].systemPromptId,
      values,
      outputLanguage: "nl",
    });

    expect(prompt).not.toMatch(/\{\{(\w+)\}\}/);      // nothing left unresolved
    expect(prompt).toContain("<a real anchor phrase>"); // independent sanity check
  });

  it("enforces required fields", () => {
    const tool = getToolBySlug("<slug>")!;
    expect(tool.inputs.filter((f) => f.required).length).toBeGreaterThan(0);
  });

  it("has NL/EN parity on input labels", () => {
    const tool = getToolBySlug("<slug>")!;
    for (const input of tool.inputs) {
      expect(typeof input.label !== "string" && input.label.nl).toBeTruthy();
      expect(typeof input.label !== "string" && input.label.en).toBeTruthy();
    }
  });
});
```

Run `npm run test:watch` → it fails because the tool isn't registered (right reason).

### 2. GREEN — author the four pieces + two registrations

**a. Prompt text** — `app/lib/prompts/files/<slug>.nl.md` and `<slug>.en.md`. Use
`{{placeholder}}` for each input `name`, plus `{{contextProfile}}` if the tool injects the
teaching-context profile. **Both languages must share the same placeholder set** (a global
test enforces this).

**b. Prompt definition** — `app/lib/prompts/<slug>.prompt.ts` (versioned tools:
`<slug>@v1.prompt.ts`):

```ts
import type { PromptDef } from "./types";
import nl from "./files/<slug>.nl.md?raw";
import en from "./files/<slug>.en.md?raw";

const verbatim = `…the book's verbatim appendix prompt (CC BY 4.0)…`;

export const <SLUG>_PROMPT: PromptDef = {
  id: "<slug>@v1",
  verbatim,
  runtime: { nl, en },
};
```

**c. Register the prompt** — in `app/lib/prompts/index.ts`: import `<SLUG>_PROMPT` and add
it to the `ALL: PromptDef[]` array.

**d. Tool definition** — `app/lib/registry/tools/<slug>.ts` (the real `Tool` shape):

```ts
import type { Tool } from "../types";
import { <SLUG>_PROMPT } from "~/lib/prompts/<slug>@v1.prompt";
import { attribution } from "~/lib/prompts/attribution";

export const <camelSlug>: Tool = {
  id: "<slug>",
  slug: "<slug>",
  name:    { nl: "…", en: "…" },
  tagline: { nl: "…", en: "…" },
  icon: "lightbulb", // Lucide name
  userType: "instructor", // or "student"
  mode: "one-shot",
  theory: {
    name:    { nl: "…", en: "…" },
    summary: { nl: "…", en: "…" },
    keyCitations: ["Author (Year)"],
  },
  attribution: attribution({
    chapterTitle: "…exact book chapter title (EN)…",
    authors: "…",
    sourcePages: "The Pedagogical Promptbook",
    adapted: true,
  }),
  usesContextProfile: true,
  defaultOutputLanguage: "nl",
  defaultModel: "claude-sonnet-4-6",
  defaultMaxTokens: 6144,   // required: registry test rejects a missing/0/>32k budget
  defaultTemperature: 0.5,
  enabled: true,
  phase: 1,
  inputs: [
    {
      name: "fieldOne",
      label: { nl: "Label NL", en: "Label EN" },
      kind: "textarea", // text | textarea | select | multiselect | number | boolean | image | document
      required: true,
      rows: 5,
      placeholder: { nl: "…", en: "…" },
    },
    // …more fields
  ],
  stages: [
    {
      id: "generate",
      name: { nl: "…", en: "…" },
      systemPromptId: <SLUG>_PROMPT.id,
      output: { kind: "markdown" }, // or "structured-sections" / "json"
    },
  ],
};
```

> **Multi-stage:** add more entries to `stages[]`. A later stage consumes an earlier
> output via `consumes: [{ placeholder: "coordinatesDocument", fromStageId: "analyze" }]`,
> and its prompt references `{{coordinatesDocument}}`. See `cognitive-architect` for the
> canonical four-stage example.
>
> **Original (non-book) tool:** import and use the separate helper —
> `originalAttribution({ source: { nl, en } })` from `~/lib/prompts/attribution`
> (not `attribution()`, which only takes book-chapter fields).

**e. Register the tool** — in `app/lib/registry/index.ts`: import `<camelSlug>` and add it
to the `ALL_TOOLS: Tool[]` array.

**f. File it in the goal taxonomy** — in `app/lib/registry/goals.ts`, add the tool's slug
to `TOOL_GOALS` (one of `design | assess | motivate | coach | discuss`; the goal's
`audience` must equal the tool's `userType`) and a non-empty `TOOL_KEYWORDS[slug]` list of
bilingual search synonyms. **Required for any `enabled` tool** — `tests/goals.test.ts`
fails without it. This is the registration the four-files list doesn't hint at, so it's the
usual reason a fresh tool's gate is red.

Run `npm test` → GREEN.

### 3. REFACTOR

Extract shared input groups / option sets if you duplicated any (e.g. a common
"Course context" `group`). Keep tests green.

---

## Recipe: add a chat tutor

**A chat tool is data, not a new component.** The generic `~/components/ChatView` already
renders greeting, starter chips, one-time sandbox inputs, the streaming thread
(`role="log"`, `aria-live="polite"`), the composer, and stop/regenerate — driven entirely
by `tool.chat`. Do **not** add a per-tool component or a `mode === "chat"` branch; that's
the control-flow-instead-of-data anti-pattern `AGENTS.md` forbids.

So the recipe is the **generator recipe above, plus**:

- `mode: "chat"` on the tool.
- A `chat` config:

  ```ts
  chat: {
    greeting: { nl: "Welkom!", en: "Welcome!" },
    starters: [
      { nl: "Help me OOP begrijpen", en: "Help me understand OOP" },
      { nl: "Wat is een klasse?",     en: "What is a class?" },
    ],
    allowStop: true,
    allowRegenerate: true,
  },
  ```

- The tool's `inputs` become the **one-time sandbox** shown before the chat starts.

Your `tests/tools/<slug>.test.ts` is the **same** as the generator's (resolve by slug,
prompt fills, required fields, parity). The registry test globally asserts every chat tool
has a `chat` config, and `ChatView`'s own a11y/streaming behaviour is already covered by
`tests/components/ChatView.test.tsx`. **You do not write a new `.test.tsx`** unless you
build a genuinely new interactive component (next recipe).

---

## Recipe: fix a bug

A vertical slice, not a survey.

1. **RED** — write **one** failing test that reproduces the bug at its seam. It must fail
   *because of the bug* (assertion fires), not a setup error. If you can't reproduce it in
   a test, you don't yet understand it — keep narrowing.
2. **GREEN** — minimal fix.
3. **REFACTOR** — clean up under the now-green net.

The reproduction test stays as the regression guard. Name it for the behaviour that was
wrong (`"keeps the interrupted turn out of the saved transcript"`), not the ticket number.

---

## Recipe: new / changed UI component

Interactive UI ships a `vitest-axe` test **first** (`AGENTS.md` §3). Mirror
`tests/components/ChatView.test.tsx`.

### RED — `tests/components/<Name>.test.tsx` (happy-dom env, `*.test.tsx`)

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { <Name> } from "~/components/<Name>";

// Mock ONLY system boundaries you don't own (see quality.md → When to mock):
vi.mock("~/lib/streamClient", () => ({ streamPost: vi.fn() }));
vi.mock("~/lib/i18n/useT", () => ({
  useLocale: () => "en",
  useT: () => ({ /* the message subtree this component reads */ }),
}));

describe("<Name>", () => {
  it("renders its interface with no a11y violations", async () => {
    const { container } = render(<<Name> /* required props */ />);

    // Assert behaviour through roles/labels/visible text — not internal state:
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();

    const results = await axe(container);
    expect(results.violations).toEqual([]); // zero-violations gate
  });

  it("responds to the primary interaction", async () => {
    const user = userEvent.setup();
    render(<<Name> /* props */ />);
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText("…expected result…")).toBeInTheDocument();
  });
});
```

### GREEN → REFACTOR

Build the component with semantic HTML (`label`/`htmlFor`, `fieldset`/`legend`,
focus-visible, `aria-live="polite"` for streaming regions), pass the a11y gate, then
refactor toward a deeper module — one narrow prop surface hiding the complexity.

**i18n reminder:** any new displayed string is a behaviour change — add its `nl`/`en` keys
to `app/lib/i18n/messages/{nl,en}.ts` (parity enforced by `tests/i18n.test.ts`), and wrap
displayed strings in the localized helpers rather than hardcoding.
