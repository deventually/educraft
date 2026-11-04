# Fase 23 — De BDB/BKE-werkplaats: dossier, bewijschecklist, portfoliocoach, Word-export

> **Zo voer je deze brief uit:** open hem in een verse sessie en voer hem precies uit, test-first
> volgens `AGENTS.md` / de `/tdd`-skill. Doe de interne fasen op volgorde (23.1 → 23.6). **Elke
> fase is één PR**; laat elke fase door `npm test && npm run typecheck && npm run check` komen. Hangt
> af van P15 (toasts) en de documentupload (`app/lib/documents/extract.ts`). **Hangt niet af van
> P20**; de koppeling met cursussen komt in P24. Branch per fase vanaf `main`.

## Context en doel

Beginnende hbo-docenten moeten hun **BDB** (Basiskwalificatie Didactische Bekwaamheid) en **BKE**
(Basiskwalificatie Examinering) halen. Een hogeschool rekent daar nu 100 tot 300 uur voor, verspreid
over 3 tot 18 maanden (bij één hogeschool: 240 uur BDB, waarvan ongeveer 84 uur BKE). Het praktijkmateriaal
(lessen, feedback, een afgenomen toets) is meestal al verzameld voordat het schrijven begint. Het
doel van Bastiaan: **het portfolio in een paar werkdagen af, met een hoge kwaliteit.**

Het onderzoek en de keuzes staan in het voorstel "BDB en BKE in een paar dagen" (Claude Doc in het
project) en in BESLUIT-2026-11-04-5 t/m -10. Kort:

- BDB/BKE wordt een **apart deel van de app**, de werkplaats, met één **dossier** per traject.
- Elke hogeschool heeft eigen criteria. De werkplaats werkt daarom met het **kader van de eigen
  hogeschool**, dat de docent uploadt. Wij leveren geen hogeschoolkader mee (auteursrecht), alleen
  een openbaar startskelet uit het landelijke protocol.
- De **portfoliocoach** leest een hoofdstuk zoals een strenge assessor en zegt per criterium: wat is
  aangetoond, wat ontbreekt, en wat het bewijs nog **sterker** maakt (de "goed"-kolom van een
  criterium).
- **Coachen is de standaard; tekst laten opstellen is een keuze van de docent.** Eén neutrale
  melding de eerste keer, verder geen waarschuwingen. De verantwoordelijkheid ligt bij de docent.
- **Export naar Word** (.docx), omdat hogescholen één Word-bestand vragen (bijvoorbeeld voor de BKE).

## Vaste besluiten (bevestigd door Bastiaan, 4 november 2026)

1. **Eigen deel van de app.** Route `/portfolio` (Engelse slug), UI-naam "BDB/BKE-werkplaats" /
   "Teaching qualification workspace". De bestaande tools worden vanuit de werkplaats ingezet, maar de
   werkplaats is geen tool in het register (het is een samenstel van data en pagina's, net als
   `/projects`).
2. **Coachen standaard, schrijven als keuze** (BESLUIT-2026-11-04-6). LimeOnIt leest de docent niet
   de les.
3. **Kader van de eigen hogeschool** is de maatstaf. Het is altijd door de docent bevestigd voordat
   het wordt gebruikt (een LLM-extractie is een voorstel, geen waarheid).
4. **Bronnen:** de coach noemt nooit literatuur die niet in het dossier staat (eigen bronnenlijst van
   de docent of de vaste lijst `app/lib/portfolio/sources.ts`, alleen met geverifieerde titels).
5. **Word-export mag een nieuwe dependency gebruiken** (BESLUIT-2026-11-04-9): het npm-pakket
   `docx` (MIT, geen native code). Pin de versie.
6. **Studentdata:** de docent plakt bewijs als tekst. Er is geen bestandsopslag en geen video. Scores
   van studenten komen pas in P25 (standaard geanonimiseerd).

## Het model (`app/lib/portfolio/types.ts`)

```ts
export type Track = "bdb" | "bke";

/** One assessable criterion from the institution's form. */
export interface Criterion {
  id: string;              // uuid
  text: string;            // the criterion as the institution words it (≤ 1 000 chars)
  strongLevel?: string;    // optional "goed"/excellent description (≤ 1 000 chars)
}

/** A learning outcome / kerntaak / BKE quality, holding its criteria. */
export interface Outcome {
  id: string;
  code: string;            // "LU1", "BKE-1" … (≤ 20 chars)
  title: string;           // ≤ 200
  criteria: Criterion[];   // 1..15
  requiredEvidence: string[]; // e.g. "video van de les", "feedback werkplekbegeleider" (≤ 20)
}

export interface FormRequirements {
  maxWords?: number;        // e.g. 6000 for a BKE report
  minConstructedItems?: number; // e.g. 5
  minAnalysedItems?: number;    // e.g. 10
  aiDisclosureRequired?: boolean;
  notes?: string;           // free text, ≤ 2 000
}

export interface Framework {
  institution: string;      // free text, e.g. "Hogeschool X" (≤ 200)
  year?: string;            // "2025-2026"
  outcomes: Outcome[];      // 1..10
  requirements: FormRequirements;
  confirmedAt?: number;     // set when the teacher confirms; coach refuses an unconfirmed framework
}

export type CriterionStatus = "not-started" | "in-progress" | "shown";

export interface EvidenceItem {
  id: string;
  title: string;            // ≤ 200
  kind: "lesson-plan" | "observation-notes" | "feedback" | "test-material" | "analysis" | "other";
  text: string;             // extracted or pasted text, ≤ 300 000 chars (document cap)
  criterionIds: string[];
  sourceGenerationId?: string; // when added from "Mijn werk"
}

export interface Chapter {
  id: string;
  outcomeId: string;
  text: string;             // markdown, ≤ 300 000
  aiDrafted: boolean;       // set when the teacher used "laat opstellen"; drives only the disclosure
}

export interface Reference { id: string; apa: string } // ≤ 500 chars

export interface DossierData {
  tracks: Track[];          // ["bdb"], ["bke"] or both
  framework: Framework;
  status: Record<string, CriterionStatus>; // criterionId → status, set by the TEACHER only
  evidence: EvidenceItem[]; // ≤ 100
  chapters: Chapter[];      // ≤ 20
  references: Reference[];  // ≤ 200
  coachMode: "coach" | "draft"; // default "coach"
  draftNoticeSeenAt?: number;
  aiLog: { at: number; action: "review" | "draft"; outcomeId: string; model: string }[]; // ≤ 500
}
```

- `DossierDataSchema` (Zod) is de grens, met de limieten hierboven. Verwijzingen naar onbekende
  `criterionId`/`outcomeId` worden door een refinement **geweigerd**.
- Opslag volgt het `context_profiles`-patroon: één tabel `portfolio_dossiers` (`id`, `userId`
  notNull, `name`, `dataJson`, `createdAt`, `updatedAt`), als geheel bewerkt. **Eén migratie.**
- Coachuitvoer wordt **niet** in het dossier bewaard maar als gewone `generations`-rij
  (`toolSlug = "portfolio-coach"`), zodat "Mijn werk" en het gebruik vanzelf meetellen.

## 23.1 — Puur domein (`app/lib/portfolio/`)

- `types.ts`, `schema.ts` (`DossierDataSchema`, `emptyDossier(tracks)`), `skeleton.ts`.
- `skeleton.ts`: een **openbaar startskelet** uit het landelijke protocol van de Vereniging
  Hogescholen: BDB met de vijf kerntaken (doceren, begeleiden, ontwerpen, toetsen, professioneel
  docentschap) en BKE met BKE-1 toetscyclus, BKE-2 toetsprogramma, BKE-3 toetsbeleid. Alleen titels
  en de korte omschrijving uit het protocol, als `LocalizedText`. Duidelijk gelabeld als "landelijk
  skelet, vervang door het formulier van je hogeschool". **Geen tekst uit hogeschoolmateriaal.**
- `edit.ts`: pure, onveranderlijke bewerkingen (outcome/criterion/evidence/chapter/reference
  toevoegen, wijzigen, verwijderen; `setStatus`; `confirmFramework`). Een criterium verwijderen haalt
  het weg uit `status` en uit elke `evidence.criterionIds`.
- `progress.ts` (geen LLM):
  - `outcomeProgress(data)` → per outcome: aantal criteria, aantal `shown`, ontbrekend verplicht
    bewijs (een `requiredEvidence`-regel zonder gekoppeld bewijs van een passend `kind`, op
    trefwoord, adviserend).
  - `wordCount(markdown)` en `requirementFindings(data)` → bijv. `over-word-limit`,
    `ai-disclosure-missing` (als `aiDisclosureRequired` en `aiLog` niet leeg en er geen
    verantwoording in de export komt), `criterion-without-evidence`.
  - `nextStep(data)` → één aanbevolen volgende stap (kader bevestigen → bewijs koppelen → hoofdstuk
    schrijven → laten keuren → exporteren).
- `aiDisclosure.ts` (geen LLM): maakt uit `aiLog` een korte verantwoordingsalinea (NL/EN) en een
  APA-verwijzing voor het gebruikte model. Alleen in de export als de docent dat aanzet.
- **Testplan (RED):** `tests/portfolio/schema.test.ts`, `edit.test.ts`, `progress.test.ts`,
  `aiDisclosure.test.ts`, met één gericht geval per bevinding en het negatieve geval.

## 23.2 — Persistentie

- Tabel `portfolio_dossiers` in `schema.server.ts`; `npm run db:generate` maakt migratie 0011.
- Repository `app/server/repositories/portfolio.server.ts`: `listDossiers` (limiet), `getDossier`,
  `createDossier`, `updateDossier` (parset opnieuw met `DossierDataSchema`; ongeldig → fout, niets
  geschreven), `deleteDossier`. Alles async en per `userId` afgebakend.
- `deleteUserCascade` ruimt `portfolio_dossiers` op.
- **Testplan (RED):** `tests/api/portfolio-repo.test.ts`: CRUD-rondreis; een dossier van een
  ander is onzichtbaar en niet bij te werken; ongeldige data wordt geweigerd; de cascade; de limiet.

## 23.3 — Werkplaats-UI zonder AI

- **Routes:** `portfolio` (lijst + aanmaken: naam, BDB/BKE/beide), `portfolio/:id` (overzicht),
  `portfolio/:id/framework` (kader), `portfolio/:id/outcome/:outcomeId` (bewijs + hoofdstuk).
  `requireRole("teacher", "admin")`; een vreemd dossier → 404.
- **Menu:** een item "BDB/BKE" in `AppShell` (desktop + mobiel). Dit wijkt af van
  BESLUIT-2026-11-04-3 (vier items); zie *Wat Bastiaan moet beslissen*.
- **Kader** (`/framework`): start met het skelet of met een upload. De upload gebruikt de bestaande
  `fileToText` (PDF/DOCX in de browser); de tekst gaat naar 23.4 (extractie). Daarna een
  bewerkbare lijst van leeruitkomsten en criteria, en een knop "Kader bevestigen". Zonder bevestiging
  is de coach uit.
- **Overzicht:** per leeruitkomst de voortgang (x van y criteria aangetoond, als tekst en niet alleen
  een balk), ontbrekend verplicht bewijs, de bevindingen uit `requirementFindings` en één "volgende
  stap".
- **Leeruitkomstpagina:** bewijsstukken (plakken of uploaden als tekst, koppelen aan criteria), het
  hoofdstuk (textarea met woordenteller), en per criterium een status die **alleen de docent**
  zet. Gewone `<Form method="post">` per actie met een `intent`; werkt zonder JS; `useFormToast`.
- **Vanuit Mijn werk:** op `/projects` per generatie "Voeg toe aan dossier" (dossier- en
  leeruitkomstkeuze) → een `EvidenceItem` met `kind: "other"`, `sourceGenerationId` en de
  uitvoertekst.
- **i18n:** namespace `portfolio.*` in `messages/{nl,en}.ts`.
- **Testplan (RED):** componenttests met axe nul overtredingen voor lijst, overzicht, kader en
  leeruitkomstpagina; `tests/api/portfolio-route.test.ts` per intent, vreemd dossier → 404,
  ongeldige payload → gelokaliseerde fout; `AppShell.test.tsx` voor het menu-item.

## 23.4 — Kader-extractie (LLM, één keer per dossier)

- Prompt `app/lib/prompts/files/portfolio-framework.{nl,en}.md` + `portfolio-framework@v1.prompt.ts`,
  volgens `TEMPLATE.md` (Voice & Bounds). Invoer: de tekst van het formulier. Uitvoer: **alleen
  JSON** volgens `FrameworkSchema` (outcomes, criteria, strongLevel waar het formulier een "goed"-
  niveau heeft, requiredEvidence, requirements).
- Regels in de prompt: neem criteria **letterlijk** over; verzin niets; laat een veld weg als het
  formulier het niet noemt; markeer onzekerheid in `notes`.
- **Code controleert de uitvoer:** Zod-parse; elk `criterion.text` moet (genormaliseerd op
  witruimte) letterlijk in de invoertekst voorkomen, anders wordt het criterium gemarkeerd als
  "controleer dit" in de UI. Mislukt de parse, dan één nieuwe poging, daarna een gelokaliseerde fout.
- Server-actie op `/framework` (intent `extract`) via `providerForModel(...).generate`, met het
  model dat de gebruiker mag kiezen (`isModelSelectableForUser`). Telt mee in `usage`.
- **Testplan (RED):** prompt-structuurtests (placeholders, Voice & Bounds, NL/EN-pariteit);
  `tests/portfolio/extract.test.ts` met een nepprovider: geldige JSON → kader; een verzonnen
  criterium → gemarkeerd; kapotte JSON → één retry → fout.

## 23.5 — Portfoliocoach (LLM, de kern)

- Prompt `portfolio-coach.{nl,en}.md` + `@v1`. Invoer: het bevestigde kader van één leeruitkomst
  (criteria + strongLevel + requiredEvidence), het hoofdstuk, korte uittreksels van het gekoppelde
  bewijs, de bronnenlijst van de docent en `requirements`.
- **Rol:** een ervaren, strenge maar vriendelijke assessor die alleen beoordeelt op de criteria van
  de instelling. De kandidaat draagt de bewijslast: wat de assessor moet afleiden, telt niet als
  aangetoond.
- **Uitvoer: alleen JSON** (`CoachReviewSchema`):

  ```ts
  { criteria: [{ criterionId, verdict: "shown" | "partial" | "missing",
                 quote?: string,          // verbatim span from the chapter that shows it
                 gap?: string,            // what is missing, concrete
                 strengthen: string[],    // ≤ 3 concrete moves toward strongLevel
                 evidenceNeeded: string[] // ≤ 3, from requiredEvidence where possible
               }],
    overall: string }                     // ≤ 600 chars
  ```

- **Code controleert de uitvoer (anti-verzinnen):**
  - elk `criterionId` bestaat en elk criterium komt precies één keer voor;
  - een `quote` moet letterlijk in het hoofdstuk staan; zo niet, dan wordt `verdict` teruggezet naar
    `partial` en krijgt de docent dat te zien;
  - een titel of auteur in `strengthen` die niet in de bronnenlijst of `sources.ts` staat, wordt
    weggefilterd (eenvoudige match op auteur + jaartal).
- **UI:** "Laat beoordelen" op de leeruitkomstpagina toont per criterium het oordeel, het citaat, het
  gat en de verbetertips. De coach zet **nooit** zelf een status; de docent kan met één klik
  "Markeer als aangetoond" doen.
- **Schrijfmodus (keuze):** in `coachMode: "draft"` kan de docent per criterium "Stel een alinea op"
  vragen, met het eigen bewijs als enige bron. De eerste keer verschijnt één neutrale melding
  (NL/EN, i18n-sleutel `portfolio.draft.notice`), daarna niet meer (`draftNoticeSeenAt`). Elke
  opgestelde tekst komt in de textarea, waar de docent hem aanpast. `aiLog` krijgt een regel.
- **Evals (verplicht voordat 23.5 live gaat):**
  - `evals/portfolio-coach/cases.json` + `rubric.md` met **synthetische** hoofdstukken waarvan de
    fout bekend is: een criterium alleen gesuggereerd, een citaat dat niet bewijst, een ontbrekend
    verplicht bewijsstuk, een sterk hoofdstuk (de coach mag niet vitten).
  - **Privé-cases:** het harnas leest extra cases uit `EVALS_PRIVATE_DIR` (een map buiten de repo,
    lokaal bij Bastiaan). Niets daaruit wordt gecommit;
    rapporten over privé-cases noemen alleen case-id's en scores. Voeg een test toe die faalt als
    `evals/` een bestand uit die map bevat (op naam).
  - Een eval-run kost geld (ongeveer €1–3). **Vraag Bastiaan eerst**; de nulmeting van het harnas is
    nog nooit gedraaid.
- **Testplan (RED):** prompt-structuurtests; `tests/portfolio/coach.test.ts` met een nepprovider
  voor elke controle hierboven; componenttest met axe voor het beoordelingspaneel en de melding.

## 23.6 — Export naar Word

- Dependency `docx` (gepind). Server-resource-route `portfolio/:id/export` (GET) → `.docx`, alleen
  voor de eigenaar.
- Inhoud: titelpagina (naam dossier, instelling, jaar, datum), per leeruitkomst het hoofdstuk
  (markdown → koppen, alinea's, lijsten, tabellen), bijlagen (bewijsstukken in volgorde), de
  bronnenlijst (APA, zoals de docent hem invoerde, alfabetisch), en optioneel de AI-verantwoording
  uit 23.1. Woordentelling exclusief bijlagen op de titelpagina.
- Toegankelijk document: echte kopstijlen, documenttaal ingesteld, tabellen met kopregel.
- **Testplan (RED):** `tests/portfolio/export.test.ts`: het bestand opent (zip met
  `word/document.xml`), bevat de koppen in volgorde, de bronnenlijst is alfabetisch, de
  AI-verantwoording staat er alleen in als die aan staat; route-test: vreemd dossier → 404.

## Buiten bereik (volgende briefs)

- **P24** Toets bouwen: toetsmatrijs, vier-ogencheck per vraag, beoordelingsmodel en cesuur;
  koppeling dossier ↔ P20-cursus; bestaande tools openen met het dossier voorgevuld.
- **P25** Toetsanalyse: import uit TestVision, ANS, Remindo en het HU-sjabloon "Itemanalyse";
  p-waarde, gokcorrectie, a-waarden, D-index, Rit/Rir, alfa/KR20 in code; standaard
  geanonimiseerd; duiding en verbeterplan met AI.
- **P26** Oefenen en feedback: proefassessment (professionele dialoog van 30 minuten),
  feedbackvragenlijsten per criterium, feedback op medekandidaten, lesvoorbereiding en lesevaluatie
  met een kijkwijzer op aantekeningen (geen video).
- SKE, delen met de werkplekbegeleider in de app, bestandsopslag.

## Acceptatie

`npm test && npm run typecheck && npm run check` zijn groen na elke subfase.

Handmatig nalopen (23.6):
1. Een docent maakt een dossier "BDB 2026" aan, uploadt het beoordelingsformulier van de eigen
   hogeschool, controleert het kader en bevestigt het.
2. Bij leeruitkomst Doceren plakt de docent een lesvoorbereiding en feedback, koppelt die aan
   criteria en schrijft een hoofdstuk.
3. "Laat beoordelen" geeft per criterium een oordeel met een citaat dat echt in de tekst staat, en
   noemt geen bron die niet in de bronnenlijst staat.
4. De docent markeert twee criteria als aangetoond; het overzicht toont de voortgang en de volgende
   stap.
5. De export opent in Word met de juiste koppen, bijlagen en bronnenlijst.
6. Een tweede docent kan het dossier niet zien.

## Wat Bastiaan moet beslissen

1. **Menu:** een vijfde menu-item "BDB/BKE" (advies), of de werkplaats als tegel op de startpagina
   (dan blijft BESLUIT-2026-11-04-3 met vier items staan).
2. **Eval-run:** akkoord op ongeveer €1–3 per run voor de nulmeting en de coach-evals.
