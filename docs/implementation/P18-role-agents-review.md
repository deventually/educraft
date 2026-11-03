# Phase 18 — Role agents: on-demand review (STUB / not yet scoped)

> **Status:** ⚪ stub. It records the intent so the phase can be picked up cold. **Depends on P17**
> (courses and the deterministic alignment checks). Branch from `main`.

## Why this exists

Second step of the teacher-assistant track. P17 gives the teacher a course graph and deterministic
findings. P18 adds the **judgement half**: role agents ("hats") that review a course, or a generation
linked to it, the way a critical colleague would.

## Locked decisions (from the November 2026 vision discussion)

- **Advise, never edit.** An agent produces findings. The teacher accepts or dismisses each one (with
  an optional reason), and that decision is logged. The log is the human-oversight trail and later
  the eval signal.
- **On demand first.** The teacher clicks "Laat beoordelen" (have it reviewed). Proactive/scheduled
  review comes with P19.
- **Necessaries = pack base + teacher layer.** Agents check against the teacher's own outcomes (P17)
  **and** pack frameworks. The first pack is HBO-i: outcomes get tagged with beroepstaak /
  architectuurlaag / beheersingsniveau from `DOMAIN_PACKS.ICT`. Only verified frameworks are used,
  never invented ones.
- **hbo first.**

## Sketch (not final)

1. **Agents as registry data** (`app/lib/agents/`), with no per-agent control flow:
   `{ id, role: LocalizedText, personaPromptId, watches: ("course" | "generation")[], checks:
   ("alignment" | promptId)[] }`. v1 has two hats: **Toetsdeskundige** (toetsmatrijs, Bloom spread,
   wording, cesuur) and **Ontwerper** (constructive alignment, activating teaching, time budget).
2. **Two-layer review:** P17's `checkAlignment` (deterministic), then one LLM pass per hat with
   structured JSON output (`{ findings: [{ severity, targetId?, message, suggestion }] }`),
   Zod-parsed with no free text dumped into the UI. Prompts follow `TEMPLATE.md` (Voice & Bounds).
3. **Storage:** `agent_reviews` (course/generation, agent id, model, findings JSON, createdAt) and
   `review_decisions` (finding id, accepted/dismissed, reason), owner-scoped. One migration.
4. **UI:** a review panel on `/courses/:id` and on a linked generation, with accept/dismiss per
   finding and a toast on completion.
5. **Evals:** add hat prompts to the eval harness (needs the P3 baseline run first). Seed it with
   courses that have known flaws and assert the hat finds them.

## Out of scope

Autonomous edits; scheduling (P19); student-facing agents; the Cases add-on (simulations).
