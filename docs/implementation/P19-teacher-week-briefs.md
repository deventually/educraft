# Phase 19 — The teacher's week: dashboard, scheduled briefs, ICS (STUB / not yet scoped)

> **Status:** ⚪ stub. It records the intent so the phase can be picked up cold. **Depends on P17**
> (courses); P18 is optional (findings in the brief). Branch from `main`.

## Why this exists

Third step of the teacher-assistant track: the assistant keeps a **rhythm** instead of waiting to be
asked. Grading, deadlines and gaps in the course plan should come to the teacher, not the other way
round.

## Sketch (not final)

1. **Real dates:** add a course `startDate` so that P17's relative weeks map onto calendar weeks
   (holidays/blocks may be a later refinement).
2. **"Deze week" dashboard** (the teacher's landing page): this week's activities and assessments
   across the teacher's courses, open alignment findings, and recent linked work.
3. **Job runner:** a `jobs` table plus an in-process tick worker. Single-instance and
   database-per-tenant make that sound. Each job is bounded (timeout, retry cap, idempotent), and the
   worker stops cleanly on shutdown. **This is the scheduler the later Cases add-on reuses** for
   delayed character replies, so keep it generic.
4. **Sunday brief:** a scheduled job composes a weekly brief per teacher (next week's activities,
   what's still unlinked or unassessed, P18 findings if present). Delivered in-app first; email is
   opt-in later.
5. **ICS export** of a course schedule (read-only feed), instead of calendar OAuth.

## Out of scope

Calendar write-back/OAuth; push notifications; student-facing schedules; the Cases add-on.
