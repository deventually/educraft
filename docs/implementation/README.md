# Implementation sessions

Each file here is a **self-contained brief** for one work session. Open one in a fresh
Claude Code session and it can be executed cold — no prior conversation needed.

**Standing contract:** [`/AGENTS.md`](../../AGENTS.md) · TDD loop: the `/tdd` skill.
**Architecture depth:** [`wiki/Architecture.md`](../../wiki/Architecture.md) ·
[`wiki/Adding-a-Tool-or-Pack.md`](../../wiki/Adding-a-Tool-or-Pack.md).

## How to start a session

Paste this into a new session (swap the file):

> Read `docs/implementation/P0-security-hardening.md` and implement it exactly. Work
> test-first per the `/tdd` skill / `AGENTS.md` — write the failing tests from the
> spec's Test Plan first. Verify with `npm test`, `npm run typecheck`, `npm run check`,
> and the spec's acceptance criteria before finishing.

---

## P-series — hardening & commercialization program (July 2026)

Implements [`docs/Improvement-Plan.md`](../Improvement-Plan.md), remediating
[`docs/Audit-2026-07.md`](../Audit-2026-07.md). **Execute in dependency order, not by
number** — later phases assume their dependencies landed (P2 quotas need P1 users; P4
settings replace P0's hardcoded model allow-list). One phase per session; finish, run
the gates, commit.

**Recommended order: … P3, then P6 → P7, then P4 → P5.** P6/P7 depend only on P1+P2
(both done), so they take precedence over P4: P6's cohort-based provisioning supersedes
P4's role-only invite admin, so building it first avoids throwaway. (P6.8 edits the four
learner-tutor prompts — run P3's eval baseline for those tutors first so the change stays
measurable.)

Ground rules for every phase:

1. **Read `AGENTS.md` first.** TDD is non-negotiable: RED (the failing tests listed in
   the spec's Test Plan) → GREEN → REFACTOR. Gate before done: `npm test && npm run
   typecheck && npm run check`, no exceptions. Every new interactive component ships a
   vitest-axe zero-violations test. All displayed strings bilingual. Tools-as-data —
   never per-tool control flow.
2. **When a spec conflicts with reality** (a file moved, a signature changed), the
   spec's *intent* wins — adapt the mechanics, keep the acceptance criteria.
3. **Do not gold-plate.** Each spec lists what is explicitly out of scope; respect it.

| Session | Scope | Depends on | State |
| --- | --- | --- | --- |
| [P0](P0-security-hardening.md) | Zod stream body + caps · model allow-list · rate limiting · per-tool maxTokens · drizzle patch · security headers · CI | — | ✅ `0c9cdd2` |
| [P1](P1-auth-roles-scoping.md) | Invite auth · roles (student/teacher/admin) · per-user scoping · real migrations · async repos + `getDb()` seam | P0 | ✅ |
| [P2](P2-ops-feedback-compliance.md) | Structured logging · daily quotas · tester feedback · AI-notice/compliance shape · healthz · deploy → **invites go out** | P1 | ✅ |
| [P3](P3-prompts-eqf-evals.md) | Prompt TEMPLATE.md · EQF 1–8 context · eval harness (baseline first!) · weak-prompt refactors · multi-turn stability | P2\* | 🟨 code/prompts/harness done; **baseline + after eval pending owner run** (needs `ANTHROPIC_API_KEY`, ~€1–3/run — see `evals/README.md`) |
| [P4](P4-admin-console.md) | Instance settings (tools/models availability) · admin routes: tools, models, invites, cohorts, usage, feedback · effective-availability module · **+ scope**: per-teacher invite tool allow-list, teacher-only invites (admins via `create-admin`/promotion — see [Tenancy-and-Admin.md](../Tenancy-and-Admin.md)), admin cohort oversight + delete-any, multi-teacher cohorts, admin↔teacher view-as switch | P2 | ✅ (branch `p4-admin-console`) |
| [P5](P5-test-tech-debt.md) | api.stream integration tests · missing component/tool tests · client i18n fix · shared sandbox hook · boot validation · AGENTS.md truth pass · dep upgrades | P4 | ⬜ |
| [P6](P6-student-provisioning.md) | Cohorts + curated per-invite/batch invites · cohort-aware access · membership-injected tutor level (EQF payoff) · anti-sharing (single active session) — impl. of [ADR 0001](../adr/0001-student-provisioning-cohorts-mentor-insight.md) D1–D4 | P1, P2 | ✅ |
| [P7](P7-mentor-insight.md) | Privacy-safe mentor insight: de-personalised session summaries · engagement + effectiveness views (no raw transcript) · student self-report — ADR 0001 D5 | P6 | ✅ (branch `p7-mentor-insight`) |

\* P3 only needs P0 technically (eval harness + prompts are independent of auth), but
runs after P2 so tester feedback can inform the prompt work.

When a session is done, tick its box and note the merge commit.

---

## S-series — the 14-tool build (complete, historical)

**Master plan:** `/Users/bastiaandressen/.claude/plans/can-you-make-a-atomic-bee.md`

```text
S1  Foundation (test harness + docs + TDD skill)         no deps — do FIRST
 ├─ S2  Generators: Forum Autograder + Contextualization      needs S1
 ├─ S3  Chat infra + MentorAI                                 needs S1
 │    ├─ S5  Tutors: Think-Pair-Share + Socratic Partner          needs S3
 │    ├─ S6  Tutors: Bloom by Design + Dialogic Encounters        needs S3
 │    └─ S7  Tutors: Peer Tutoring + Scaffolding Feedback         needs S3
 └─ S4  Image infra + Math Grading                            needs S1
```

| Session | Scope | Depends on | State |
| --- | --- | --- | --- |
| [S1](S1-foundation.md) | Test harness · `AGENTS.md`/`CLAUDE.md` · `/tdd` skill | — | ✅ `b58aee6`+`fc7164b` |
| [S2](S2-generators.md) | Forum Autograder + Contextualization (one-shot) | S1 | ✅ `86a8ad1` |
| [S3](S3-chat-infra-mentorai.md) | Chat infrastructure + MentorAI | S1 | ✅ `4982074` |
| [S4](S4-image-infra-math-grading.md) | Image pipeline + Math Grading | S1 | ✅ `aea5648` |
| [S5](S5-tutors-tps-socratic.md) | Think-Pair-Share + Socratic Partner | S3 | ✅ `0b01b79` |
| [S6](S6-tutors-bloom-dialogic.md) | Bloom by Design + Dialogic Encounters | S3 | ✅ `0b01b79` |
| [S7](S7-tutors-peer-scaffolding.md) | Peer Tutoring + Scaffolding Feedback | S3 | ✅ `0b01b79` |

**All 7 sessions complete — 14/14 tools shipped** (a 15th, stage-assessment, was added
later outside the S-series). S5–S7's six chat tutors were authored together in one
`tutors` branch (one clean merge, no registration conflicts).
