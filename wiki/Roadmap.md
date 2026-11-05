# Roadmap

The path from today's pilot to the global [Vision](../docs/VISION.md). This is
**direction, not commitment** — sequence by real demand. The current-state list also
lives in the [README](../README.md).

---

## Shipped

- 15 tools: the 14 from the book plus one original (assess student work against the teacher's
  rubric). See [Tools](Tools.md).
- Invite auth with two roles (teacher, admin) and an owner; a four-page admin console with
  autosave; models per instance with a per-teacher override.
- The simplification rounds V1 (student layer removed) and V2 (admin simplified).
- Documents read in the browser, a document viewer, and anonymisation before sending.
- The BDB/BKE workplace (`/portfolio`) with a coach and Word export.
- Utilities without AI: the grade calculator and saved rubrics.
- Courses and the alignment spine (P20): learning outcomes, activities and assessments with Bloom
  and study load, a coverage matrix and advisory checks, and work from the tools linked to a course.

## Next (proposed order)

The live order is on the board ([`docs/fabriek/STATUS.md`](../docs/fabriek/STATUS.md)); briefs
live in [`docs/implementation/`](../docs/implementation/README.md).

The teacher-assistant track builds on the course from P20:

1. **Courses further** (brief P26): an assessment blueprint per question, outcomes imported from a
   course guide, the course as BDB/BKE evidence.
2. **One workflow** (brief P27): a next step under every result, BDB/BKE joining in, a Start page.
3. **Role agents** (brief P21): two "hats" review a course on request.
4. **The teacher week** (brief P22): planning and weekly briefings.

## Later (parked on purpose)

- Practice simulations (add-on).
- Voice (dictation, read-aloud).
- A student layer, rebuilt and better.

---

## Vision tracks (cross-cutting, sequence by demand)

These realize the [Vision](../docs/VISION.md) and run alongside the list above.

- **Level spine** — add EQF 1–8 as a first-class dimension across NL
  (VO / mbo / hbo / wo); anchor to ISCED. See
  [Qualification Frameworks](Qualification-Frameworks.md).
- **Learner-noun parameterization** — stop hard-coding *"studenten"*; read the
  [learner profile](Context-Model.md#the-learner-noun-problem-a-concrete-near-term-task)
  from context.
- **Framework-pack system** — generalize the hbo-i pack into the
  [pack mechanism](Context-Model.md#packs); add a first non-NL country (e.g. US or
  UK) as a second pack.
- **Instance-wide context availability** *(P12, simplified in P18)* — admins set the sectors
  and domains teachers can pick; there is no per-teacher *custom access* and no country
  choice any more. See [Context Model](Context-Model.md#availability-p18).
- **Multilingual UI** — extend the i18n catalog beyond nl/en.
- **Global reach** — target regions: Europe, US, Canada, Australia, New Zealand,
  South Africa, and more wherever the model applies.
- **Community packs** — eventually, community-contributed country & curriculum packs.

## Deferred tech debt

- **React Router 7 → 8** — *done* (2026-11-04, PR #65): React Router 8.5.1 and React 19.3.1.
  Meta and `useMatches` read `loaderData`; the SSR entry takes a `RouterContextProvider`.

## Related

- [Vision](../docs/VISION.md) · [Tools](Tools.md) · [Context Model](Context-Model.md)
