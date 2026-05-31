# LimeOnIt

Evidence-based onderwijs ontwerpen met generatieve AI. LimeOnIt zet de
onderwijsmethoden uit **The Pedagogical Promptbook** (David Wiley, red. — CC BY 4.0)
om in werkende tools. Elke tool koppelt een onderwijstheorie aan een zorgvuldig
ontworpen, geëvalueerde prompt. De eerste focus ligt op het **hbo-i** (hoger
beroepsonderwijs ICT) en op Nederlandstalige uitvoer.

## Snel starten

```bash
npm install
cp .env.example .env        # vul ANTHROPIC_API_KEY in
npm run db:migrate          # maakt data/limeonit.db aan
npm run dev                 # http://localhost:5173
```

Zonder `ANTHROPIC_API_KEY` start de app wel, maar genereren geeft een nette
foutmelding. Een key haal je op via https://console.anthropic.com/.

## Tools (MVP — fase 1)

| Tool | Methode | Type |
|------|---------|------|
| Begeleide reflectie & Backward Design | Backward Design | generator (één fase) |
| Cognitive Architect | Science of Learning (Gagné/Rosenshine) | generator (vier fasen) |
| Authentieke toetsing | Backward Design + VALUE rubrics | generator (één fase) |
| ARCS Reactor | ARCS-V motivatiemodel | generator (één fase) |

De prompts zijn afkomstig uit de appendices van het boek (CC BY 4.0) en
aangepast (interview → één keer genereren, en vertaalbaar naar het Nederlands).
De **originele, woordelijke prompt** is per tool zichtbaar via "Bekijk originele
prompt", en de bron/attributie staat in de tool-header en op `/about`.

## Architectuur

React Router 7 (framework mode, SSR) · TypeScript · Tailwind v4 · SQLite (Drizzle).

```
app/
  routes/            home · tool · settings · about · projects · api.stream (SSE)
  components/        AppShell · DynamicForm · GeneratorView · StageStepper · ResultPanel · ui
  lib/
    registry/        types.ts (de Tool-abstractie) · validate.ts · tools/<tool>.ts
    prompts/         <tool>.prompt.ts  (woordelijke + aangepaste prompt) · index.ts (PROMPTS-map)
    ai/              types · models (catalogus) · provider · adapters/anthropic · sse
    template/        interpolate · buildSystemPrompt  (prompt + context + taal + fasen samenvoegen)
    context/         types · hboi  (hbo-i contextprofiel)
    i18n/nl.ts       UI-teksten
  server/            env · db (auto-schema) · schema · repositories/*
```

### Hoe een tool werkt

Elke tool is **data**, geen code. Een `Tool` (zie `app/lib/registry/types.ts`)
beschrijft: gebruikerstype, interactiemodus, invoervelden (`inputs` → het
formulier wordt automatisch gerenderd), en één of meer `stages` met elk een
`systemPromptId`. `stages` is de unificator: een one-shot generator heeft één
fase, de Cognitive Architect vier (waarbij latere fasen via `consumes` de uitvoer
van eerdere fasen injecteren). Een nieuwe tool toevoegen = een promptbestand +
een registry-entry, daarna in `app/lib/registry/index.ts` registreren.

### Een nieuwe tool toevoegen

1. `app/lib/prompts/<tool>.prompt.ts` — exporteer een `PromptDef` met de
   woordelijke (`verbatim`) en de runtime (`runtime`) prompt; voeg toe aan
   `app/lib/prompts/index.ts`.
2. `app/lib/registry/tools/<tool>.ts` — definieer de `Tool` (velden + fasen).
3. Registreer in `app/lib/registry/index.ts`.
4. `npm test` valideert automatisch dat elke `{{placeholder}}` een bron heeft.

## Tests & checks

```bash
npm test           # registry-validatie, interpolatie, buildSystemPrompt
npm run typecheck  # react-router typegen + tsc
npm run build      # productiebuild
```

## Roadmap

- **Fase 2** — overige generators (Bloom by Design, Forum Autograder, wiskunde-nakijken met beeldinvoer) + OpenAI/Gemini-adapters.
- **Fase 3** — studentgerichte chatbots (MentorAI, Think-Pair-Share, Socratische tutor) via de bestaande chat-infrastructuur.
- **Fase 4** — evaluatie met synthetische studenten, multi-model vergelijking, PDF/DOCX-export, deelbare links.

## Licentie & attributie

De prompts komen uit *The Pedagogical Promptbook* (DOI 10.59668/2340), CC BY 4.0,
en worden met bronvermelding gebruikt en aangepast.
