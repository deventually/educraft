---
name: tdd
description: TDD loop for EduCraft — red/green/refactor with test templates for tools and chat tutors
---

# TDD Skill — EduCraft Red-Green-Refactor

Use this skill when:
- **Adding a tool** (generator or chat tutor)
- **Implementing test-first** (bug fix, new feature, refactor)
- **Starting any TDD session** — write the failing test first

The loop is always: **RED** → **GREEN** → **REFACTOR** → verify (`npm test`, `npm run typecheck`, `npm run check`).

## The Loop (5 steps)

### 1. RED — Write the failing test

Pick your template below; write the test under `tests/` (either `tools/` or `components/`). Run `npm run test:watch` to see it fail.

### 2. GREEN — Minimal implementation

Write just enough code to make the test pass. No refactoring yet.

### 3. REFACTOR

Extract shared logic, deduplicate, improve names. Keep tests green.

### 4. VERIFY

```bash
npm test                 # All tests pass
npm run typecheck       # No type errors
npm run check           # No lint/format issues
```

### 5. DONE

Commit with a clear message. Move to the next task.

---

## Template: Add a Tool (Generator)

Use this when building a **generator tool** (one-shot or multi-stage). The test validates the registry, prompt resolution, and input fields.

### File: `tests/tools/<id>.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { getToolBySlug } from "~/lib/registry";
import { buildSystemPrompt } from "~/lib/template/buildSystemPrompt";

describe("tool: <id>", () => {
  it("registers and resolves by slug", () => {
    const tool = getToolBySlug("<id>");
    expect(tool).toBeDefined();
    expect(tool?.title.en).toBe("<Tool Title>");
  });

  it("builds prompt with no unresolved placeholders", () => {
    const tool = getToolBySlug("<id>")!;
    const inputs = {
      // Provide a value for every required input field
      fieldName1: "example text",
      fieldName2: 5,
    };
    
    const prompt = buildSystemPrompt(tool, inputs);
    expect(prompt).not.toMatch(/\{\{(\w+)\}\}/); // No unresolved {{…}}
    expect(prompt).toContain("expected anchor text"); // Sanity check
  });

  it("enforces required fields", () => {
    const tool = getToolBySlug("<id>")!;
    const requiredFields = tool.stages[0]?.inputs.filter(f => f.required);
    expect(requiredFields?.length).toBeGreaterThan(0);
  });

  it("has NL/EN parity in placeholders and labels", () => {
    const tool = getToolBySlug("<id>")!;
    for (const input of tool.stages[0]?.inputs || []) {
      expect(input.label.nl).toBeDefined();
      expect(input.label.en).toBeDefined();
    }
  });
});
```

### Implementation Files

Once the test fails (RED), create:

1. **`app/lib/prompts/files/<id>.nl.md`** — Dutch prompt with `{{placeholder}}` syntax
2. **`app/lib/prompts/files/<id>.en.md`** — English prompt
3. **`app/lib/prompts/<id>@v1.prompt.ts`** — Export the prompt and `buildPrompt` function:

```typescript
import nl from "./files/<id>.nl.md?raw";
import en from "./files/<id>.en.md?raw";

export const <id>Prompt = {
  nl,
  en,
};

export async function buildPrompt(inputs: Record<string, unknown>) {
  // Transform inputs into final prompt (if needed); most tools just use the template directly.
  return { nl, en };
}
```

4. **`app/lib/registry/tools/<id>.ts`** — Register the tool:

```typescript
import type { Tool } from "~/lib/registry/types";
import { <id>Prompt } from "~/lib/prompts/<id>@v1.prompt";

export const <id>Tool: Tool = {
  id: "<id>",
  title: { nl: "...", en: "..." },
  description: { nl: "...", en: "..." },
  mode: "one-shot",
  stages: [
    {
      id: "generate",
      inputs: [
        {
          name: "fieldName1",
          label: { nl: "Label NL", en: "Label EN" },
          kind: "textarea",
          required: true,
        },
        // ... more fields
      ],
      output: { kind: "markdown" },
      promptId: "<id>@v1",
    },
  ],
  enabled: true,
};
```

5. **Register in `app/lib/prompts/index.ts`:**

```typescript
export { <id>Prompt } from "./<id>@v1.prompt";
```

6. **Register in `app/lib/registry/index.ts`:**

```typescript
import { <id>Tool } from "./tools/<id>";

export const TOOLS: Tool[] = [
  // ... existing tools
  <id>Tool,
];
```

Run `npm test` — test should now **GREEN**.

---

## Template: Add a Chat Tool

Use this when building a **chat tutor** tool. The test validates greeting, starters, sandbox inputs, and accessibility.

### File: `tests/tools/<id>.test.ts` (same as generator above)

The registry/prompt test is identical. Once GREEN, add:

### File: `tests/components/<id>.test.tsx`

```typescript
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { <Id>ChatView } from "~/components/chat/<id>";
import { getToolBySlug } from "~/lib/registry";

describe("<Id> Chat View", () => {
  it("renders greeting and starter chips with no a11y violations", async () => {
    const tool = getToolBySlug("<id>")!;
    const { container } = render(
      <<Id>ChatView tool={tool} contextProfile={mockProfile} onGenerationStart={() => {}} />
    );

    // Check greeting is rendered
    expect(screen.getByText((content) => content.includes("greeting text"))).toBeInTheDocument();

    // Check starter chips are rendered
    const starters = screen.getAllByRole("button");
    expect(starters.length).toBeGreaterThan(0);

    // Accessibility: no violations
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });

  it("sends a message and streams a response", async () => {
    const tool = getToolBySlug("<id>")!;
    const user = userEvent.setup();
    const { container } = render(
      <<Id>ChatView tool={tool} contextProfile={mockProfile} onGenerationStart={() => {}} />
    );

    // Type and send a message
    const input = screen.getByRole("textbox");
    await user.type(input, "Hello, tutor");
    const sendBtn = screen.getByRole("button", { name: /send|submit/i });
    await user.click(sendBtn);

    // (Optional: mock the streaming response, or rely on integration-like behavior)
    // Verify the message appears in the thread
    expect(screen.getByText("Hello, tutor")).toBeInTheDocument();
  });
});
```

### Implementation: Create `ChatView`

Once the test fails (RED), implement the component. See the [plan](https://...) or `AGENTS.md` for the full chat infrastructure. Sketch:

1. **`app/components/chat/<id>.tsx`** — The chat UI component
   - Render greeting (localized)
   - Render starter chips (buttons)
   - One-time sandbox inputs (InputField-driven form)
   - Message thread with `aria-live="polite"`
   - Composer (text input + send button)
   - Stop / Regenerate (if multi-turn)

2. **Register in `app/routes/tool.tsx`:**

```typescript
if (tool.mode === "chat") {
  return <ChatView tool={tool} ... />;
}
```

Run `npm test` — test should **GREEN**.

---

## Checklist: Before Merge

- [ ] `npm test` — all tests pass (node + DOM environments)
- [ ] `npm run typecheck` — no type errors
- [ ] `npm run check` — no lint/format issues
- [ ] New test captures the behavior (RED → GREEN)
- [ ] Refactored toward deeper modules / less duplication
- [ ] Commit message is clear (mentions what, not how)
- [ ] No leftover `console.log` or debugging code

---

## FAQ

**Q: How do I debug a failing test?**
A: Run `npm run test:watch`, then edit the test or code. Changes re-run instantly.

**Q: Can I skip the test and just write code?**
A: No. TDD is a standing rule; it catches edge cases and documents intent.

**Q: What if my test is too hard to write first?**
A: That usually means the design is unclear. Sketch the shape first (what inputs/outputs?), then test the shape, then implement.

**Q: How do I add a tool that depends on earlier tool output (multi-stage)?**
A: Same flow, but with multiple stages in the tool definition. See `Cognitive Architect` as an example.

**Q: Where do I find the prompt templates?**
A: `app/lib/prompts/files/<id>.{nl,en}.md`. Use `{{placeholder}}` syntax and reference the chapter appendix in the book.
