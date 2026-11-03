# Phase 17 — Courses & the alignment spine

> **How to run this brief:** open it in a fresh session and implement it exactly, test-first per
> `AGENTS.md` / the `/tdd` skill. Do the internal phases in order (17.1 → 17.5); gate each with
> `npm test && npm run typecheck && npm run check` before moving on, and commit the phase. **Depends
> on** P1 (users + scoping), P8 (context profiles), P15 (toasts). Branch from `main`.

## Context & goal

LimeOnIt is becoming a **teacher's assistant** (product decision, November 2026). This is the first
phase of that track: teacher tooling comes first, and AI-assisted course simulations such as
"Webshop Bob" come later as a separate add-on. The later assistant features are role agents that
review your work (P18) and a weekly rhythm with briefs (P19). Both need **one shared object to work
on**, and today there isn't one: every generation is a standalone result in `/projects`, with no
idea which course, learning outcome or test it belongs to.

P17 adds that object, a **Course**, together with the deterministic half of "don't stray from the
necessaries":

```
learning outcome ──taught by──▶ activity (lesson / assignment)
        └──────assessed by──▶ assessment (formative / summative) at a Bloom level
generation ──linked to──▶ course (optionally to one activity / assessment)
```

From that graph, pure functions can derive a **coverage matrix** and **findings**:

- an outcome that no activity teaches;
- an outcome that no summative assessment tests;
- an outcome assessed before it is taught;
- an assessment that tests below the outcome's Bloom level;
- an activity that serves no outcome.

No LLM is involved in P17. These checks are cheap and testable, and they are the base the P18 agents
build on.

## Locked decisions (user-confirmed)

1. **hbo first.** Copy and terminology target hbo ("leeruitkomst", "onderwijsactiviteit", "toets").
   The *engine* stays sector-neutral: nothing in `app/lib/courses/` knows about hbo, and other sectors
   reuse it unchanged.
2. **Advise, never edit.** Findings are advisory. Nothing auto-changes the teacher's course, and the
   teacher decides.
3. **Necessaries = pack base + teacher layer.** P17 delivers the teacher layer (the teacher's own
   outcomes) plus the universal Bloom axis. Tagging outcomes with **pack** frameworks (HBO-i
   beroepstaak / architectuurlaag / beheersingsniveau from `DOMAIN_PACKS`) is P18.
4. **Bloom = the revised taxonomy** (Anderson & Krathwohl, 2001): `remember · understand · apply ·
   analyze · evaluate · create`, stored as English slugs and labelled bilingually. This is a verified
   framework, not an invented one.
5. **Storage:** a new `courses` table with the structure in a Zod-validated `dataJson` column (the
   `context_profiles` pattern: edited as a whole, small, no per-row joins), plus a `course_links`
   table for generation links. **One migration.** The dormant `projects` table and
   `generations.projectId` stay untouched. They are unused today; leave them for a future clean-up
   rather than overloading the word "project".
6. **Teachers and admins only.** Students never see courses in P17.

## The model (`app/lib/courses/types.ts`)

```ts
export const BLOOM_LEVELS = ["remember", "understand", "apply", "analyze", "evaluate", "create"] as const;
export type BloomLevel = (typeof BLOOM_LEVELS)[number];

export interface LearningOutcome { id: string; text: string; bloom?: BloomLevel }
export interface Activity {
  id: string; title: string; week?: number;            // relative week 1..n (no dates in P17)
  kind: "lesson" | "assignment"; outcomeIds: string[];
}
export interface AssessmentCoverage { outcomeId: string; bloom?: BloomLevel }
export interface Assessment {
  id: string; title: string; week?: number;
  kind: "formative" | "summative"; weight?: number;    // % of the final grade, summative only
  coverage: AssessmentCoverage[];
}
export interface CourseData { outcomes: LearningOutcome[]; activities: Activity[]; assessments: Assessment[] }
```

- `CourseDataSchema` (Zod) is the boundary: text ≤ 1 000 chars, titles ≤ 200, ≤ 30 outcomes, ≤ 100
  activities, ≤ 30 assessments, week 1–60, weight 0–100. References to unknown outcome ids are
  **rejected** by a refinement, so the stored graph is always consistent.
- Item ids are UUIDs that live inside the JSON. Links reference them, so they survive reordering and
  renaming.

## 17.1 — Pure domain (`app/lib/courses/`)

- `types.ts`, `schema.ts` (`CourseDataSchema`, `emptyCourseData()`), `bloom.ts` (`BLOOM_LEVELS`,
  `bloomRank(level)`, bilingual labels as `LocalizedText`).
- `edit.ts`: pure, immutable edit operations that the route actions call:
  - `addOutcome`, `updateOutcome`, `removeOutcome`. Removing an outcome **also drops every reference**
    to it in activities and assessment coverage.
  - The same operations for activities and assessments.
- `alignment.ts`:
  - `coverageMatrix(data)` → rows = outcomes, columns = activities then assessments, and each cell
    = `{ covered: boolean; bloom?: BloomLevel }`.
  - `checkAlignment(data): AlignmentFinding[]`, where
    `AlignmentFinding = { code; severity: "warning" | "info"; outcomeId?; itemId? }` and `code` is one
    of the following, with a stable order (outcome order, then item order):

    | code | severity | rule |
    | --- | --- | --- |
    | `outcome-not-taught` | warning | no activity lists the outcome |
    | `outcome-not-assessed` | warning | no **summative** assessment covers the outcome |
    | `assessed-before-taught` | warning | a summative assessment's week < the earliest week of an activity teaching that outcome (only when both weeks are set) |
    | `bloom-below-outcome` | warning | a coverage `bloom` ranks below the outcome's `bloom` (only when both are set) |
    | `activity-without-outcome` | info | an activity lists no outcomes |
    | `weights-not-100` | info | at least one summative weight is set and the summative weights don't sum to 100 |

- **Test plan (RED):**
  - `tests/courses/schema.test.ts`: valid data parses; caps enforced; a dangling `outcomeId` is
    rejected; `emptyCourseData()` parses.
  - `tests/courses/edit.test.ts`: each operation is immutable; `removeOutcome` scrubs references.
  - `tests/courses/alignment.test.ts`: one focused case per finding code, plus the negative case
    (aligned data → `[]`), the matrix shape, and the stable ordering.

## 17.2 — Persistence

- **Schema** (`schema.server.ts`):
  - `courses`: `id`, `userId` (notNull), `name`, `contextProfileId` (nullable), `dataJson`,
    `createdAt`, `updatedAt`.
  - `course_links`: `id`, `userId`, `courseId`, `generationId`, `itemId` (nullable: an activity or
    assessment id), `createdAt`; `uniqueIndex(courseId, generationId)`.
  - Run `npm run db:generate` to produce migration 0008.
- **Repository** `app/server/repositories/courses.server.ts`. Every function is async and scoped by
  `userId`, per the house rule.
  - `listCourses` (capped), `getCourse`, `createCourse`, `updateCourse` (re-parses `dataJson` with
    `CourseDataSchema`; invalid input throws, nothing is written), `deleteCourse` (also deletes its
    links, in one transaction).
  - `linkGeneration(userId, courseId, generationId, itemId?)`: verifies the caller owns **both** the
    course and the generation, and that `itemId` (if given) exists in the course; upserts on the
    unique index. Also `unlinkGeneration`, `listLinksForCourse`, `listCourseLinksForUser` (for
    `/projects` badges).
- **Cascades:** `deleteUserCascade` also purges `courses` and `course_links`; `deleteGeneration` also
  deletes that generation's links.
- **Test plan (RED):** `tests/api/courses-repo.test.ts` covers:
  - CRUD round-trip;
  - another user's course is invisible and not updatable;
  - linking someone else's generation or course is refused;
  - an unknown `itemId` is refused;
  - re-linking upserts;
  - `deleteCourse` and `deleteGeneration` drop links;
  - `deleteUserCascade` purges both tables;
  - the list cap holds.

## 17.3 — Course UI (`/courses`, `/courses/:id`)

- **Routes** (English slugs): add `courses` and `courses/:id` to `routes.ts`. Use
  `requireRole("teacher", "admin")`; a student gets a 404. A nav entry ("Cursussen" / "Courses") for
  non-students sits next to Projects in `AppShell` (desktop + mobile + footer).
- **`/courses`:** a list (name, outcome count, open-findings count) plus a create form (name and an
  optional context profile). Delete goes through `ConfirmDialog`. Wire `useFormToast`.
- **`/courses/:id`:**
  - **Sections:** Leeruitkomsten · Onderwijsactiviteiten · Toetsen · Dekkingsmatrix · Aandachtspunten
    · Gekoppeld werk.
  - **Editing:** plain `<Form method="post">` per item with an `intent` (`add-outcome`,
    `update-outcome`, `remove-outcome`, … for all three collections, plus `rename`). The action loads
    the course, applies the 17.1 edit op, and saves through the repo (Zod-validated). Bad input
    returns a localized error and never a stack trace. Assessment coverage is a checkbox per outcome
    plus an optional Bloom `<select>`. It works without JS.
  - **Matrix:** a real `<table>` with `<caption>`, `<th scope="col|row">`. A covered cell shows "✓"
    plus the Bloom label as text (never colour alone) and has an `sr-only` description.
  - **Findings:** a plain list with a severity icon plus text, using `courses.findings.<code>` i18n
    keys interpolated with the outcome or item title. Not a live region: the toast announces saves
    (P15 rule).
- **i18n:** a `courses.*` namespace in `messages/{nl,en}.ts` (parity test). Bloom labels are bilingual.
- **Help:** a short `app/content/help/courses` topic (what a course is, how the checks work, that
  they're advisory). Link it from the page.
- **Test plan (RED):**
  - `tests/components/courses-index.test.tsx`: list, empty state, create form; axe zero-violations.
  - `tests/components/course-editor.test.tsx`: sections render; the matrix has a caption and scoped
    headers; a finding renders as text; axe zero-violations.
  - `tests/api/courses-route.test.ts`:
    - each intent persists;
    - a foreign course → 404;
    - a student → 404;
    - an invalid payload (dangling outcome id, over-cap text) → error, nothing saved;
    - `remove-outcome` scrubs references.
  - `AppShell.test.tsx`: the nav shows Courses for a teacher, not for a student.

## 17.4 — Wiring generations into courses

- **`/projects`:** per generation, a small "Koppel aan cursus" form (course `<select>` plus an optional
  activity/assessment `<select>`) → `intent="link"` / `intent="unlink"`. Linked generations show a
  course badge. The course page's "Gekoppeld werk" lists linked generations, linking back to
  `/projects`.
- **Tool page: course selector + outcome prefill** (teachers only; data, not control flow):
  - Add `InputField.prefillFromCourse?: { source: "learningOutcomes" }` to `registry/types.ts`.
  - Mark the outcome fields of the instructor tools:
    - `contextualization.learningObjectives`
    - `guided-reflection.leeruitkomsten`
    - `forum-autograder.learningObjectives`
    - `authentic-assessment.leeruitkomsten`
    - `cognitive-architect.learningObjective`
  - Add `coursePrefillValues(fields, course)` in `app/lib/forms/values.ts`, mirroring
    `profilePrefillValues`: one outcome per line, `- <text>`.
  - Add `useSandbox` `selectCourse(id)`. It re-derives course-backed fields with the same
    reset-on-switch semantics, and if the course has a `contextProfileId`, also selects that profile.
  - The `tool.tsx` loader passes the user's courses (id, name, contextProfileId, outcomes).
- **Stream auto-link:**
  - Add `courseId: z.string().max(100).nullish()` to `StreamBodySchema`.
  - After `saveGeneration` / `upsertChatGeneration`, if `courseId` is set, call `linkGeneration`.
    Ownership is checked in the repo. A foreign or unknown id is **ignored and logged**, never an
    error, and the generation is still saved.
  - The client sends the selected course id.
- **Test plan (RED):**
  - `tests/lib/values.test.ts` (or extend the existing one): `coursePrefillValues`.
  - `tests/lib/useSandbox.test.tsx`: `selectCourse` prefills, switching resets, it selects the
    linked profile.
  - `tests/api/stream.test.ts`:
    - an owned `courseId` → a link row;
    - a foreign `courseId` → no link, but the generation is saved;
    - an absent one → unchanged.
  - `tests/components/Projects.test.tsx`: link control + badge; axe.
  - `tests/tools/*.test.ts` for the five tools: the field declares `prefillFromCourse`.

## 17.5 — Docs

- `AGENTS.md`:
  - a short **Courses & alignment (P17)** paragraph under Conventions: the model; checks are pure
    and advisory; `prefillFromCourse` is the data hook; links are owner-checked;
  - a Key Files entry.
- This brief's state, the README row, and a `wiki/Roadmap.md` note: the teacher-assistant track
  P17 → P18 → P19.

## Out of scope

- **LLM review / role agents** → P18. **Scheduling, weekly brief, ICS, real dates** → P19.
- Item-level toetsmatrijs (individual test questions); pack tagging of outcomes (HBO-i) → P18.
- Sharing or co-owning courses (section/team level); import from OER/Osiris/PDF; export.
- Student-facing course views; drag-and-drop reordering (week numbers order things).
- Anything from the deferred **Cases add-on** (Webshop Bob-style simulations, avatars).

## Acceptance

`npm test && npm run typecheck && npm run check` are green after each sub-phase.

Manual repro:
1. A teacher creates "Software Engineering — jaar 2" with three outcomes (one at *analyze*), four
   lessons and one summative test that covers two outcomes at *understand*.
2. The matrix shows the gaps. Findings list `outcome-not-assessed` for the third outcome and
   `bloom-below-outcome` for the *analyze* one.
3. Opening Authentic Assessment with that course selected prefills the outcomes.
4. The generated output appears linked under "Gekoppeld werk".
5. A student cannot reach `/courses`. A second teacher cannot see or link the first teacher's course.
