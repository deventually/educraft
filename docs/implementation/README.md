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
| [P5](P5-test-tech-debt.md) | api.stream integration tests · missing component/tool tests · client i18n fix · shared sandbox hook · boot validation · AGENTS.md truth pass · dep upgrades | P4 | ✅ (branch `p5-test-tech-debt`; vitest 4 + AI SDK 7 shipped, RR8 deferred) |
| [P6](P6-student-provisioning.md) | Cohorts + curated per-invite/batch invites · cohort-aware access · membership-injected tutor level (EQF payoff) · anti-sharing (single active session) — impl. of [ADR 0001](../adr/0001-student-provisioning-cohorts-mentor-insight.md) D1–D4 | P1, P2 | ✅ |
| [P7](P7-mentor-insight.md) | Privacy-safe mentor insight: de-personalised session summaries · engagement + effectiveness views (no raw transcript) · student self-report — ADR 0001 D5 | P6 | ✅ (branch `p7-mentor-insight`) |
| [P8](P8-teaching-context-overhaul.md) | Teaching-context overhaul: consolidated edit-capable editor (retires the wizard/form split) · store NLQF level → derive EQF · Dutch ladder **vo (vmbo-forms/havo/vwo)/mbo/hbo/wo** (po dropped mid-build — canonical scope is vo/mbo/hbo/wo; seam keeps `teacherNoun` for a future po re-add) · sector-scoped domains + framework-resolution seam (packs stay hbo-only) · sector-driven learner/teacher-noun directive · admin+per-teacher country/sector availability **compose seam (read)** · free-text `pedagogy`. No DB migration. | P4, P6 | ✅ (branch `p8-teaching-context`) |
| [P9](P9-context-availability-write-ui.md) | Admin + per-teacher country/sector availability **write UI**: `admin.context.tsx` instance toggles + per-teacher assignment (management flow), on top of P8's read/compose seam. Setters write the P8 `instance_settings` keys — no migration, no engine/editor change. | P8 | ✅ 9.1–9.3 (branch `p9-context-availability-write-ui`); **9.4 invite-time assignment deferred** — optional/off critical path per the brief's Out-of-scope; the 9.3 management flow delivers the value |
| [P10](P10-teaching-context-relevance.md) | Teaching-context **form relevance + per-type domains**: hide fields irrelevant to the chosen sector/track (Programme in vo, Professional field for havo/vwo; Course→"Vak" in vo); track-scope the domain dropdown and add the **verified havo/vwo + vmbo profielen** (mbo/wo stay honest custom fields — no invented taxonomy); **per-teacher domain availability** (P9-style axis: `assignedDomains` storage + `getAvailableDomains` + grouped admin UI). No migration. | P8, P9 | ✅ 10.1–10.3 (branch `p10-context-relevance`); mbo/wo kept on honest custom fields per the brutal-honesty rule (user-confirmed) |
| [P11](P11-vo-phase-onderbouw-bovenbouw.md) | **vo fase axis** (onderbouw/bovenbouw): a vo profile carries its phase; onderbouw ⇒ no profiel yet, bovenbouw ⇒ profiel shown (domain gating by phase); the fase feeds the injected context directive (`format.ts`), with relevance rules, legacy migration, parseForm handling + i18n. No migration. | P8, P9, P10 | ✅ shipped (`a904c2c`); brief backfilled retroactively |
| [P12](P12-per-teacher-override-instance-domains.md) | **Per-teacher override + instance Domains axis**: context-editor availability switches from intersect to an **override** model — a teacher inherits the instance or, via an **Activate custom access** toggle, replaces it entirely (may exceed it; empty axis = all; deactivate is non-destructive). Adds the missing **instance `enabledDomains`** axis + admin Domains section. Fixes the disjoint-settings bug (∅ intersection silently widened to the full catalogue). All keys in `instance_settings` — no migration. | P8, P9, P10 | ✅ 12.1–12.4 (branch `p12-context-override-instance-domains`) |
| [P13](P13-per-teacher-per-cohort-models.md) | **Per-teacher & per-cohort model availability**: two more model gates below the instance `enabledModels` — an admin narrows a **teacher**'s selectable models, a teacher narrows a **cohort**'s. Pure **intersect** (billing cap: teacher ⊆ instance, cohort ⊆ teacher; empty = inherit; local/CLI models stay free), the opposite of P12's override. Per-teacher = `assignedModels:<uid>` `instance_settings` key (no migration); per-cohort = new `cohorts.allowedModelsJson` column (one migration). | P4, P6 | ✅ 13.1–13.4 (`main`) |
| [P14](P14-governable-models-account-removal.md) | **Governable local/CLI models + reversible student account removal**: local/CLI/discovered models join the P13 intersect (still free, now curatable — no more silent free-pass; `isModelSelectableForUser` membership walk, grouped Frontier/CLI/Local config UIs; never student-selectable). **+** a student's `/account` request **disables** (not deletes) the account (`users.disabledAt` + `deletionRequestedAt`, migration 0007); teacher/admin see it on the cohort manage screen (Students section: badge + Remove/Restore, guarded by `assertManagesMember`) + a count badge on the cohort list. | P13, P6, P1 | ✅ 14.1–14.4 (`main`) |
| [P15](P15-user-feedback-toasts-a11y.md) | **Immediate action feedback + navigation a11y**: a global **toast/snackbar** system — on submit a *pending* "Bezig…" toast shows instantly and **updates in place** (by id) into a success/error result — bottom-right, wired across all ~9 action routes (incl. the today-silent `admin.cohorts`/`projects` deletes). `useToast()` no-ops without a provider (existing tests stay green). Plus three missing SPA-nav a11y primitives: **skip link**, **route-change announcer** (polite live region → page title), **focus-to-main** on navigation. No dependency, no migration. | — | ✅ 15.0–15.4 (branch `p15-user-feedback-toasts-a11y`) |
| [P16](P16-flash-toasts-across-redirect.md) | **Flash toasts across redirects** (P15 follow-on): a server one-shot cookie → root loader reads + clears → toast shown on arrival, so redirecting flows (login→tools, invite→home, reset→login) also get feedback. Deferred out of P15. | P15 | ⚪ stub (deferred) |
| [P17](P17-remove-student-layer.md) | **Vereenvoudiging V1: de studentenlaag eruit** — drie PR's: 17.1 mentorinzicht weg (samenvattingen, sweep, "Sessie beëindigen", chatbeurt-opslag) · 17.2 studentrol, cohorten, studentuitnodigingen, vergrendelde modus, verwijderverzoek, uitloggen bij elke login en het cohortniveau van modellen weg (uitloggen na een nieuw wachtwoord blijft) (rollen: teacher/admin; alle 15 tools blijven) · 17.3 één migratie die studentdata definitief verwijdert en cohort-/inzichttabellen en studentkolommen laat vallen (of, als Bastiaan kiest voor laten staan: geen migratie). | — (ruimt P6, P7, P13-cohort, P14 op) | ✅ 17.1–17.3 gemerged en uitgerold (2026-11-03) |
| [P18](P18-simplify-admin.md) | **Vereenvoudiging V2: eenvoudiger beheer** — acht PR's: 18.1 "Bekijk als docent" weg · 18.2 geen toegang per docent voor tools en context, land-as weg · 18.3 modellen: overrule per docent, CLI/lokaal alleen in ontwikkelmodus · 18.4 beheer naar vier pagina's (Gebruikers, Tools en modellen, Onderwijscontext, Gebruik en feedback) · 18.5 automatisch opslaan · 18.6 superbeheerder (`ownerUserId`, `set-owner`), uitnodigingen nooit beheerder · 18.7 account direct aanmaken, wachtwoord instellen, non-actief (migratie `disabled_at`) · 18.8 slapende tabellen en kolommen weg (destructieve migratie `0010`) + docs. | P17 | ✅ klaar en uitgerold (2026-11-04) |
| [P19](P19-simplify-teacher-side.md) | **Vereenvoudiging V3: de docentkant** — zes PR's: 19.1 toolnamen (taak eerst, boeknaam als ondertitel) ✅ · 19.2 geen doelgroeplabels (badges, filter "Voor studenten"), startpagina eenvoudiger · 19.3 toolpagina: taak eerst, model en redeneren achter "Geavanceerd" · 19.4 lege pagina's die sturen (`EmptyState`) · 19.5 menu: Tools · Mijn werk · Onderwijscontext · Help · 19.6 kort contextformulier op één pagina, eerste profiel vanzelf standaard. Bastiaans keuzes: BESLUIT-2026-11-04-2 t/m -4. | P17; 19.5–19.6 ook P18.1, 18.2, 18.4 | 🟨 19.1 ✅ (#18); 19.2–19.6 brief klaar |
| [P20](P20-courses-alignment-spine.md) | **Cursussen en de rode draad** (docentassistentspoor, stap 1): een `courses`-entiteit (leeruitkomsten · activiteiten · toetsen met Bloom-niveaus, Zod-gevalideerde JSON) + `course_links` naar generaties; pure **dekkingsmatrix + adviserende bevindingen** (niet onderwezen / niet getoetst / getoetst vóór onderwezen / Bloom onder leeruitkomst …); `/courses`-editor; werk koppelen vanuit `/projects`; cursuskiezer op toolpagina's vult leeruitkomstvelden voor in (`prefillFromCourse`); de stream koppelt automatisch. Eerst hbo, engine neutraal, geen LLM. Eén migratie. | P1, P8, P15 | 🟡 20.1–20.3 klaar |
| [P21](P21-role-agents-review.md) | **Rolagenten — beoordeling op verzoek**: twee "petten" als registerdata (Toetsdeskundige, Ontwerper) beoordelen een cursus; P20-controles blijven feiten zonder knoppen, pet-bevindingen krijgen Akkoord / Niet akkoord (gelogd, verworpen komt niet terug); pakket-tags uit `DOMAIN_PACKS` bij leeruitkomsten; gekoppelde toetsvragen optioneel mee nakijken. Acht deelstappen, één migratie. BESLUIT-2026-11-05-3. | P20 | ⚪ brief klaar |
| [P22](P22-teacher-week-briefs.md) | **De week van de docent**: cursusstartdatums, dashboard "Deze week", generieke begrensde jobrunner, geplande zondagbriefing, ICS-export. | P20 (P21 optioneel) | ⚪ stub |
| [P23](P23-utilities-without-ai.md) | **Hulpmiddelen zonder AI**: een eigen klein register naast de AI-tools (sectie op `/tools`, routes `/utilities`); 23.1 cijfer- en cesuurrekenaar (pure functies, instelbaar, raadkanscorrectie) · 23.2 rubrics bewaren (`rubrics`-tabel, één migratie) · 23.3 rubric invullen in batches: namen alleen in de browser, na afsluiten alleen anonieme scores per criterium (BESLUIT-2026-11-04-8). BESLUIT-2026-11-04-5. | — | ⚪ brief klaar |
| [P24](P24-teacher-ai-tools.md) | **Acht nieuwe AI-tools** met een kwaliteitspoort (≥ 5 eval-casussen waarvan 2 met een bekende fout, score ≥ Stage Assessment, tien uitkomsten door een mens beoordeeld): 24.0 nulmeting · 24.0b anonimiseren in de browser vóór versturen (BESLUIT-2026-11-04-9) · 24.0c het origineel (PDF/Word) naast de tekst, alleen in de browser (BESLUIT-2026-11-04-10) · 24.1 Stage Assessment breder (`@v2`) · 24.2 rubric maken · 24.3 toetsvragen en toetsmatrijs · 24.4 les voorbereiden · 24.5 toetsanalyse (rekenen in code) · 24.6 opdracht helder schrijven · 24.7 differentiëren · 24.8 lastig gesprek oefenen (chat). BESLUIT-2026-11-04-7. | 24.0 eerst; 24.5 ook P23.1 | ⚪ brief klaar |
| [P25](P25-bdb-bke-workplace.md) | **BDB/BKE-werkplaats** — zes PR's: 25.1 puur domein (dossier, kader van de eigen hogeschool, voortgang, AI-verantwoording) · 25.2 opslag (`portfolio_dossiers`, één migratie) · 25.3 werkplaats-UI zonder AI (`/portfolio`, bewijs, hoofdstukken, status door de docent) · 25.4 kader-extractie uit het geüploade formulier (LLM, letterlijk gecontroleerd) · 25.5 portfoliocoach (LLM, JSON, citaten gecontroleerd, schrijfmodus als keuze, evals met privé-cases) · 25.6 export naar Word (`docx`). Kortste pad: drie PR's (A domein + opslag, B UI, C coach). Vervolg hergebruikt P23 (cesuurrekenaar, rubrics) en P24 (toetsmatrijs, toetsanalyse, les voorbereiden). | P15 | ⚪ brief klaar |
| [P26](P26-course-alignment-follow-up.md) | **Cursussen verder** (vervolg op P20): 26.1 toetsmatrijs per vraag in de cursus (items, dekking afgeleid, bevindingen op vraagniveau) · 26.2 matrijs uit *Toetsvragen en toetsmatrijs* (P24.3) met één knop in de cursus, tabel in code gelezen · 26.3 leeruitkomsten en toetsen importeren uit een OER (LLM, letterlijk gecontroleerd, voorstel) · 26.4 cursus als momentopname-bewijs in het BDB/BKE-dossier. Geen migratie. | P20; 26.4 ook P25 | ⚪ brief klaar |

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
