# The quality bar — tests worth keeping

The loop (`SKILL.md`) makes tests exist. This file makes them *worth keeping*. Every
section applies on every cycle — consult it before and during the loop, not after.

## What a good test is

A good test verifies **behaviour through a public interface**, not implementation
details. Code can change entirely; the test shouldn't. It reads like a specification —
`"builds prompt with no unresolved placeholders"` tells you exactly what capability
exists — and survives refactors because it doesn't care about internal structure.

- Tests what a caller/user cares about, through the public API only.
- Describes **what**, not **how**.
- One logical assertion per test.
- Expected values come from an **independent source of truth** — a known-good literal, a
  worked example, the spec — never recomputed the way the code computes them.

## Seams — where tests go

A **seam** is the public boundary you observe behaviour at, without reaching inside.
Tests live at seams, never against internals. Naming the seam before you write the test
is how effort lands on the critical paths instead of every private detail.

The natural seams in LimeOnIt:

| Seam | Test at | Not at |
|------|---------|--------|
| Registry | `getToolBySlug(slug)` → resolves; `tool.inputs`, `tool.mode`, `tool.chat` present | a tool's private helpers |
| Prompt pipeline | `buildSystemPrompt({ promptId, values, outputLanguage })` → filled string, no `{{…}}` | the interpolation regex internals |
| Prompt data | `PROMPTS[id].runtime.{nl,en}` share a placeholder set (already covered globally) | the `?raw` import mechanics |
| Component | rendered roles, labels, `aria-live`/`role="log"` regions, visible text | component `useState`, prop-drilling |

You work **autonomously** here, so you don't need sign-off on a seam — but *state it*
(the `describe` name or a one-line comment) so the choice is deliberate, not accidental.
If you can't name the public boundary you're testing, you're probably about to test an
internal.

## Anti-patterns — pass CI, then rot

### Implementation-coupled

Mocks an internal collaborator, asserts on a private field, or verifies through a side
channel. **The tell: the test breaks when you refactor but behaviour hasn't changed.**

```ts
// BAD — asserts on internal structure of a tool
expect(tool.stages[0].inputs?.length).toBeGreaterThan(0); // stage internals

// GOOD — asserts the behaviour a caller relies on
expect(getToolBySlug("my-tool")).toBeDefined();
expect(tool.inputs.filter((f) => f.required).length).toBeGreaterThan(0);
```

### Tautological

The assertion recomputes the expected value the way the code does, so it passes *by
construction* and can never disagree with the code. Expected values must be independent.

```ts
// BAD — expected value restates the implementation
const expected = inputs.map((f) => `{{${f.name}}}`);
expect(placeholdersIn(prompt)).toEqual(expected); // proves nothing

// GOOD — an independent, known-good assertion
expect(prompt).not.toMatch(/\{\{(\w+)\}\}/);        // nothing left unresolved
expect(prompt).toContain("You are the ARCS Reactor"); // a real anchor from the prompt
```

The current-skill templates leaned tautological — e.g. "enforces required fields" only
checked a tool *has* required fields, and "NL/EN parity" only checked labels are
*defined*. Prefer asserting the observable result (the prompt resolves; the right anchor
text appears) over asserting the shape of the data you just wrote.

### Horizontal slicing

Writing all the tests first, then all the implementation. Bulk tests verify *imagined*
behaviour: you commit to test structure before understanding the implementation, and the
tests go insensitive to real changes. Work in **vertical slices** — one test, one
implementation, repeat — each a tracer bullet responding to what the last taught you.

## When to mock

Mock at **system boundaries only** — the things you don't own. In this repo that's a
short, specific list, and `tests/components/ChatView.test.tsx` is the reference:

- **Network / streaming** — `vi.mock("~/lib/streamClient")` and drive `streamPost` via
  its `onToken` / `onDone` handlers. Never hit a real endpoint.
- **i18n surface** — `vi.mock("~/lib/i18n/useT")` (`useLocale`, `useT`) and
  `~/lib/i18n/localized` (`loc`) so a component test asserts stable English strings.
- **Time / randomness** — inject or mock; never assert against a live clock.

**Do not mock what you own** — the registry, `buildSystemPrompt`, interpolation, a tool's
own data. Mocking your own modules is the implementation-coupled anti-pattern wearing a
disguise: the test then proves the mock behaves, not the code.

**Design for mockability at the boundary:** dependency injection over internally
constructed clients, and SDK-style named functions over one generic fetcher — each mock
returns one specific shape, with no conditional logic in test setup.
