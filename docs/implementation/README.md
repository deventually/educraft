# Implementation sessions — remaining 10 tools (14 total)

Each file here is a **self-contained brief** for one work session. Open one in a fresh
Claude Code session and it can be executed cold — no prior conversation needed.

**Master plan:** `/Users/bastiaandressen/.claude/plans/can-you-make-a-atomic-bee.md`
**Standing contract (after S1):** [`/AGENTS.md`](../../AGENTS.md) · TDD loop: the `/tdd` skill.
**Architecture depth:** [`wiki/Architecture.md`](../../wiki/Architecture.md) ·
[`wiki/Adding-a-Tool-or-Pack.md`](../../wiki/Adding-a-Tool-or-Pack.md).

## How to start a session

Paste this into a new session (swap the file):

> Read `docs/implementation/S2-generators.md` and the master plan it references, then
> implement it. Work test-first per the `/tdd` skill / `AGENTS.md`. Verify with
> `npm test`, `npm run typecheck`, `npm run check`, and the preview tools before finishing.

## Dependency graph

```
S1  Foundation (test harness + docs + TDD skill)         no deps — do FIRST
 ├─ S2  Generators: Forum Autograder + Contextualization      needs S1
 ├─ S3  Chat infra + MentorAI                                 needs S1
 │    ├─ S5  Tutors: Think-Pair-Share + Socratic Partner          needs S3
 │    ├─ S6  Tutors: Bloom by Design + Dialogic Encounters        needs S3
 │    └─ S7  Tutors: Peer Tutoring + Scaffolding Feedback         needs S3
 └─ S4  Image infra + Math Grading                            needs S1
```

**Parallelism:** after S1, run S2 / S3 / S4 concurrently. After S3, run S5 / S6 / S7
concurrently. Each session should be its own branch/worktree to avoid collisions
(S2/S5/S6/S7 only add files; S3/S4 touch shared files — `api.stream.tsx`,
`registry/types.ts`, `DynamicForm.tsx` — so land those before fanning out).

## Status

| Session | Scope | Depends on | State |
|---|---|---|---|
| [S1](S1-foundation.md) | Test harness · `AGENTS.md`/`CLAUDE.md` · `/tdd` skill | — | ✅ `b58aee6`+`fc7164b` |
| [S2](S2-generators.md) | Forum Autograder + Contextualization (one-shot) | S1 | ✅ `86a8ad1` |
| [S3](S3-chat-infra-mentorai.md) | Chat infrastructure + MentorAI | S1 | ✅ `4982074` |
| [S4](S4-image-infra-math-grading.md) | Image pipeline + Math Grading | S1 | ☐ |
| [S5](S5-tutors-tps-socratic.md) | Think-Pair-Share + Socratic Partner | S3 | ☐ |
| [S6](S6-tutors-bloom-dialogic.md) | Bloom by Design + Dialogic Encounters | S3 | ☐ |
| [S7](S7-tutors-peer-scaffolding.md) | Peer Tutoring + Scaffolding Feedback | S3 | ☐ |

When a session is done, tick its box and note the merge commit.
