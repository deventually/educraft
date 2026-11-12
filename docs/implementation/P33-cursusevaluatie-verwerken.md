# Fase 33 — Cursusevaluatie verwerken: van enquête naar verbeterpunten voor de volgende uitvoering

> **Status:** ⚪ brief. Mag nu (BESLUIT-2026-11-12-10). Zo voer je deze brief uit: één deelstap per
> sessie, elke deelstap één PR vanaf `main`, test-first volgens `AGENTS.md` / de `/tdd`-skill, poort
> `npm test && npm run typecheck && npm run check`. Merge nooit zelf; alleen Bastiaan merget.
> Volgorde en gedeelde bestanden met de andere docenthulpjes: `README.md`, *Docenthulpjes*.

## In gewone taal

Na elke uitvoering van een cursus krijgt de docent een studentenenquête terug: scores en een stapel
open antwoorden. Dat verwerken kost twee à drie uur, en de verbeterpunten raken vaak kwijt tot de
volgende keer. LimeOnIt kent de cursus al tot op de les en de toets, dus het kan de feedback daar
aan vastmaken. Een losse chatbot kan dat niet.

De docent plakt de enquête (of een CSV) op het tabblad *Controle* van de cursus. Na anonimiseren in
de browser krijgt hij drie blokken:

1. **Wat zeiden studenten.** Thema's met hoe vaak ze terugkomen en twee of drie letterlijke citaten
   per thema, positief en negatief apart.
2. **Waar ging het mis.** Elk probleem op zijn plek in de cursus (week, les, toets of leeruitkomst),
   aangevuld met de toetsanalyse als die er is. Wat de data niet zegt, wordt een vraag, geen
   conclusie.
3. **Wat kan er beter.** Drie tot vijf verbeterpunten, elk met de plek en een eerste voorstel. De
   docent zegt per punt *Akkoord* of *Niet akkoord*, zoals bij het reviewteam.

De verbeterpunten waar de docent akkoord op gaf, horen bij de cursus. Bij *Kopiëren voor een nieuwe
uitvoering* (#300) komen ze mee als open punten op het tabblad *Controle* van de kopie. Zo sluit de
PDCA-cirkel.

Herkomst: onderzoek "Docenttaken en hulpjes in LimeOnIt", hulpje 1 en het deel *Feedback op de
cursus*; Bastiaan: "Ook feedback voor de cursus. Wat hebben studenten gezegd, waar ging het mis, wat
kan er beter".

## Vaste uitgangspunten

1. **Adviseren, nooit aanpassen** (BESLUIT-2026-11-02-4). Het hulpje schrijft geen leeruitkomst,
   les of toets. Alleen een verbeterpunt met *Akkoord* komt in de cursusdata, als apart veld.
2. **Geen verzonnen citaten.** Een citaat dat niet letterlijk in de (geanonimiseerde) invoer staat,
   valt weg in code, zoals bij het proeflezen (`app/lib/portfolio/proofread.ts`). Een plek die niet
   in de cursus bestaat (onbekend id), valt ook weg.
3. **Ruwe antwoorden worden niet bewaard.** Alleen de thema's (zonder citaten) en de goedgekeurde
   verbeterpunten. De open antwoorden gaan door de namencheck in de browser
   (`app/lib/privacy/redact.ts`, zoals bij *Bewijs in één keer*, BESLUIT-2026-11-12-7) voordat er
   tekst weggaat.
4. **Over het onderwijs, niet over personen.** Feedback over een docent of medestudent wordt geen
   thema en geen verbeterpunt; de prompt zegt dat, en de evals toetsen het. Een cursus kan gedeeld
   zijn (P28.4, `course_members`), dus dit is ook een privacyregel.
5. **Kleine groepen eerlijk.** Het aantal respondenten telt de code (rijen in de CSV, of een getal
   dat de docent invult). Onder de 10 staat boven de uitkomst dat er voorzichtig gelezen moet worden.
   Een thema dat maar één keer voorkomt, heet geen thema.
6. **De cursus is één JSON-graaf** (`CourseDataSchema`, niet `.strict()`): het nieuwe veld is
   optioneel, dus geen migratie.

## Deelstappen

### 33.1 — Verbeterpunten in de cursusdata, en mee bij kopiëren (geen AI, geen migratie)

- `app/lib/courses/schema.ts` en `types.ts`: optioneel `improvements: Improvement[]`, met `id`,
  `text` (LocalizedText is niet nodig: de docent schrijft in één taal), `place` (`{ kind: "course" }`
  of `{ kind: "outcome" | "activity" | "assessment", id }`), `status: "open" | "done"`, `source:
  "evaluation" | "teacher"`, `run` (het studiejaar of de periode waaruit het komt). Cap op het aantal
  (bijvoorbeeld 30) in `COURSE_LIMITS`.
- `app/lib/courses/newRun.ts`: `forNewRun` neemt de open verbeterpunten mee en laat de afgeronde
  weg. Een plek waarvan het id niet meer bestaat, wordt `course`.
- Tabblad *Controle* (`app/routes/courses.$id.tsx`, componenten onder `app/components/courses/`):
  blok *Verbeterpunten* met de open punten op hun plek, *Afgerond* per punt, en *Zelf een punt
  toevoegen*. Een nieuwe intent in de course-action, zoals `copyRunAction` in
  `app/server/courseCopy.server.ts`; een bewerker mag dit (inhoud, AGENTS.md).
- **RED:** `forNewRun` neemt open punten mee en afgeronde niet; een verweesde plek wordt `course`;
  de schema-cap; de intent weigert ongeldige invoer (Zod); component met axe.

### 33.2 — De prompt en de controle in code (`course-evaluation@v1`)

- Prompt `app/lib/prompts/course-evaluation@v1.prompt.ts` + `files/course-evaluation.{nl,en}.md`
  volgens `TEMPLATE.md`. Placeholders: `{{evaluation}}` (geanonimiseerde tekst), `{{respondents}}`
  (getal uit de code), `{{courseOutline}}` (leeruitkomsten, lessen en toetsen met hun id en titel,
  gebouwd in code uit de cursus), `{{testAnalysis}}` (optioneel: per gekoppelde toetsanalyse de
  p-waarden en Rir per vraag, als tekst), `{{contextProfile}}`.
- Antwoord als JSON: `themes[]` (`label`, `polarity`, `count`, `quotes[]`), `problems[]` (`place`,
  `text`, `basis`: `students` | `data` | `question`), `improvements[]` (`place`, `text`).
- Pure parser `app/lib/courses/evaluation.ts`: Zod, onbekende sleutels weg, citaten die niet
  letterlijk in `{{evaluation}}` staan weg, plekken met een onbekend id naar `course`, hooguit vijf
  verbeterpunten, `count` niet hoger dan het aantal respondenten.
- Server `app/server/courseEvaluation.server.ts`: roept de provider aan via `app/lib/ai/` (patroon:
  `portfolioAi.server.ts` of `agentReview.server.ts`), met het dagquotum en het model dat de docent
  kiest. Slaat niets op.
- **Evals:** minstens vijf cases (`evals/`), waarvan twee met een bekende fout: een enquête met een
  naam van een docent erin (mag geen thema worden) en een uitschieter van één student (mag geen
  thema worden). Plus een case met tien respondenten en een toetsanalyse met een slechte vraag.
- **RED:** de parser (verzonnen citaat weg, onbekende plek, te veel punten, te hoge `count`);
  `buildSystemPrompt` laat geen `{{…}}` open; NL/EN-pariteit.

### 33.3 — Het scherm op het tabblad *Controle*

- Blok *Cursusevaluatie verwerken*: plakken of CSV kiezen (in de browser gelezen), het aantal
  respondenten (uit de CSV, of in te vullen), de namencheck met de bestaande privacycomponenten
  (`app/components/privacy/`), dan *Verwerken*.
- Resultaat in drie blokken. Per verbeterpunt *Akkoord* (komt in `improvements`, `source:
  "evaluation"`) of *Niet akkoord* (weg, wordt niet bewaard). Feedback via `useActionToast`.
- Op de kopie (#300) toont het blok *Verbeterpunten uit de vorige uitvoering* bovenaan *Controle*.
- Help: een sectie in het helponderwerp van cursussen (`app/content/help/`, NL en EN).
- **RED:** component (invoer, privacystap verplicht vóór verwerken, akkoord schrijft, niet akkoord
  niet), axe; e2e niet nodig. Een `/accessibility-review` van het tabblad.

## Volgorde

`33.1 ──▶ 33.2 ──▶ 33.3`. 33.1 is op zichzelf bruikbaar (zelf verbeterpunten bijhouden die
meekomen naar de volgende uitvoering). 33.2 kan ook parallel aan 33.1 als de parser het type uit
33.1 nog niet nodig heeft.

## Buiten deze fase

- Evaluatie van één les of workshop (een kort formulier na de les, en de antwoorden naar
  verbeterpunten bij die les). Dat is hetzelfde patroon op lesniveau; pas als de pilot erom vraagt.
- Een koppeling met het enquêtesysteem van de hogeschool (Evalytics, Qualtrics).
- Verbeterpunten over de hele opleiding (dat is P32, de examencommissie).

## Keuzes voor Bastiaan

| # | Vraag | Advies |
| --- | --- | --- |
| 1 | Mag een bewerker (geen eigenaar) een evaluatie verwerken en verbeterpunten goedkeuren? | **Ja.** Het is inhoud van de cursus; bewerkers mogen inhoud (BESLUIT-2026-11-10-5). |
| 2 | Bewaren we de thema's (zonder citaten) bij de cursus? | **Nee in deze fase.** Alleen de verbeterpunten; dan is er niets van studenten om te beschermen. |
