# Fabrieksbord

> Het bord van de Producer. Een werker werkt het bij **in dezelfde PR** als zijn werk. Een lege sectie
> blijft leeg. Kort houden: dit is een bord, geen archief. Geschiedenis staat in `geschiedenis.md`,
> `docs/implementation/README.md` en git.

_Laatst bijgewerkt: 2026-11-05 (P22.4 en P27.4 open)_

## Nu

- **Klaar om in te leveren? (P29.1, #117) gemerged op 2026-11-05:** in stap 5 van het
  BDB/BKE-dossier één lijst met per punt "Los op", zelf afvinken met datum; advies, geen poort.
- **De week van de docent op Start (P22.3, #113) gemerged op 2026-11-05:** per cursus *In de les*,
  *Voorbereiden* en *Nakijken*, vanaf vrijdag ook *Volgende week*; zonder startdatum een hint.
- **De week van de docent, puur (P22.2, #111) gemerged op 2026-11-05:** `teacherWeek` rekent per
  cursus deze week, voorbereiden, nakijken en aandachtspunten; nog geen scherm.
- **De week van de docent, echte datums (P22.1b, #110) gemerged op 2026-11-05:** een startdatum
  per cursus en bij elke les en toets "Week 3 · 17–23 nov", vakantieweken overgeslagen.
- **Gebruikers aanvinken en in één keer aanpassen (#109) gemerged op 2026-11-05:** op
  `/admin/users` "Met geselecteerde": in of uit een team, en (superbeheerder) op non-actief of
  weer actief, met een bevestigingsvraag bij op non-actief zetten.
- **De week van de docent, rekenhart en schoolkalender (P22.1a, #106) gemerged op 2026-11-05:**
  weken rekenen in ISO-weken en de vakantieweken als één lijst voor de instelling op
  `/admin/context`.
- **Teams als lijst met een pagina per team (#107) gemerged op 2026-11-05:** `/admin/teams` met
  zoeken en één knop "Nieuw team", per team een pagina waar je meerdere collega's tegelijk
  aanvinkt en toevoegt.
- **Cursus als bewijs in het BDB/BKE-dossier (P26.4 + 26.5, #95) gemerged op 2026-11-05:** op de
  cursuspagina "Gebruik als bewijs in BDB/BKE" als momentopname, "Opnieuw ophalen" in het dossier en
  een hint bij criteria over toetsmatrijs of afstemming. Plus de documentatie. Daarmee is P26 af.
- **OER-import (P26.3, #89) gemerged op 2026-11-05:** leeruitkomsten en toetsen uit een OER of
  studiehandleiding als voorstel dat de docent aanvinkt; eindmeting 18 van 18 runs geslaagd.
- **Matrijs uit de tool in de cursus (P26.2, #94) gemerged op 2026-11-05:** bij een gekoppelde
  toetsmatrijs staat "Zet matrijs in cursus"; de docent kiest de toets en per rij de leeruitkomst.
- **Toetsmatrijs per vraag (P26.1, #92) gemerged op 2026-11-05:** per toets een tabel met per vraag
  leeruitkomst, denkniveau, vraagvorm en punten; de vragen bepalen de dekking.
- **Teams en teamleiders (P28.2, #93) gemerged op 2026-11-05:** teams op `/admin/teams`, een
  teamleider beheert zijn team op `/teams/:id`, uitnodigen in een team, "Mijn teams" op de
  accountpagina.
- **Gebruikersbeheer in een paar klikken (P28.1, #91) gemerged op 2026-11-05:** één lijst met
  zoeken en filteren, status en laatst actief, uitnodigingen als rij, één knop "Toevoegen" en een
  pagina per persoon (`/admin/users/:id`).
- **BDB/BKE doet mee (P27.2, #88) gemerged op 2026-11-05:** "Dit heb je misschien al" (eerder werk
  als bewijs voorstellen), de route in vijf stappen bovenaan het dossier, de BDB/BKE-schakelaar per
  docent en de weg terug van criterium naar tool en weer terug.
- **Cursussen, de documentatie (P20.5, #86) gemerged op 2026-11-05:** alinea in `AGENTS.md`, wiki
  en README. Daarmee is P20 af.
- **Cursussen koppelen (P20.4, #84) gemerged op 2026-11-05:** bovenaan tien toolpagina's een
  cursuskiezer die de leeruitkomsten invult en het resultaat aan de cursus koppelt; koppelen op
  "Mijn werk"; "Gekoppeld werk" op de cursuspagina.
- **Brief P27 De rode draad (#83) gemerged op 2026-11-05:** één workflow met de cursus als
  thuisbasis, volgende stap onder elk resultaat, BDB/BKE doet mee, startscherm met drie ingangen en een
  menu van vier (BESLUIT-2026-11-05-4).
- **Rolagenten, pakket-tags bij leeruitkomsten (P21.6, #105) gemerged op 2026-11-05:** kenmerken
  uit het pakket van de cursus per leeruitkomst; de petten krijgen ze mee.
- **Rolagenten, het paneel "Beoordeling" (P21.5, #104) gemerged op 2026-11-05:** knop, adviezen per
  pet, Akkoord / Niet akkoord met reden, melding als de cursus daarna is gewijzigd.
- **Rolagenten, "Laat beoordelen" aan de serverkant (P21.4, #103) gemerged op 2026-11-05:** beide
  petten kijken de cursus na op het gekozen model; besluiten worden vastgelegd.
- **Rolagenten, opslag (P21.3, #102) gemerged op 2026-11-05:** beoordelingen van een pet en de
  besluiten van de docent worden bewaard (migratie 0018); verworpen adviezen komen niet terug.
- **Rolagenten, petten als data (P21.1, #81) gemerged op 2026-11-05:** register van de twee petten,
  de invoer onder korte sleutels en de controle op het antwoord; nog zonder AI en scherm.
- **Rolagenten, de twee AI-teksten (P21.2, #85) gemerged op 2026-11-05:** Toetsdeskundige en
  Ontwerper (NL/EN) met de meting `npm run eval:agents`; tussenronde ra1 10 van 10 geslaagd, de
  eindmeting (3 runs) wacht op akkoord.
- **Cursussen, de pagina's (P20.3, #82) gemerged op 2026-11-05:** menu-item "Cursussen", per
  cursus de gegevens met EC, leeruitkomsten, activiteiten, toetsen, aandachtspunten en de
  dekkingsmatrix.
- **Brief P21 Rolagenten (#80) gemerged op 2026-11-05:** twee petten kijken een cursus na op
  verzoek, met akkoord/niet akkoord (BESLUIT-2026-11-05-3); 21.1 kan starten.
- **Cursussen, opslag (P20.2, #79) gemerged op 2026-11-05:** tabellen `courses` en `course_links`
  (migratie 0014), per docent afgeschermd.
- **Brief P26 Cursussen verder (#77) gemerged op 2026-11-05:** toetsmatrijs per vraag,
  OER-import en de cursus als bewijs in het BDB/BKE-dossier, na P20 (BESLUIT-2026-11-05-2).
- **Cursussen, het rekenhart (P20.1, #78) gemerged op 2026-11-05:** cursusmodel met
  leeruitkomsten, activiteiten, toetsen, Bloom en studielast, en de afstemmingscontroles; nog geen
  scherm.
- **Lastig gesprek oefenen (P24.8, #75) gemerged op 2026-11-05:** de AI speelt een verzonnen
  student in een moeilijk gesprek en geeft daarna feedback met citaten; eindmeting dc3 elke case
  4,60–4,93.
- **Opdracht differentiëren (P24.7, #76) gemerged op 2026-11-05:** drie varianten met hetzelfde
  leerdoel naar Tomlinson (2017); eindmeting df2 elke case 4,73–5,00.
- **Opdracht helder schrijven (P24.6, #73) gemerged op 2026-11-05:** opdracht of handleiding
  herschreven op taalniveau B1 met open punten en eisencheck; eindmeting ca2 elke case 4,67–5,00.
- **Toetsanalyse na afloop (P24.5, #74) gemerged op 2026-11-05:** hulpmiddel item-analysis rekent,
  tool test-analysis legt uit; eindmeting ta3 elke case 4,53–4,93.
- **Les voorbereiden (P24.4, #72) gemerged op 2026-11-05:** concept-lesopzet volgens Rosenshine
  (2012), met een tijdsplan dat optelt tot de lesduur; elke case 4,53–5,00 in meting lp3.
- **Toetsvragen en toetsmatrijs (P24.3, #67) gemerged op 2026-11-05,** in de stand van meting t;
  de bekende punten staan onder Later.
- **Beoordelingsmodel: een gebrek telt bij één criterium (#71) gemerged op 2026-11-04:** na meting q;
  meting s zonder regressie.
- **Product:** LimeOnIt, docententools op basis van *The Pedagogical Promptbook*: 16 tools (10 voor
  docenten, 6 tutors), tweetalig NL/EN, gericht op hbo.
- **Gebruik:** pilot met een aantal docenten en leden van een examencommissie.
- **Stack:** React Router 8, SQLite (Drizzle), AI SDK (standaard Claude Sonnet 5.5) + lokale modellen,
  Vitest + axe. 878 tests, CI groen op `main`.
- **Laatst op `main` (2026-11-03):** V1 (P17) gemerged en uitgerold: de studentenlaag is eruit en de
  studentdata is gewist; de back-up van vóór de migratie wordt op 2026-11-10 verwijderd. Eerder: P15
  (toasts, navigatie-toegankelijkheid), Claude 5.5-modellen, documenten tot 300k tekens, briefs
  P20–P22, de fabriek.
- **P23.1 + 23.2 gemerged op 2026-11-04:** de plek voor hulpmiddelen, de cijferrekenaar en rubrics
  bewaren (migratie 0012).
- **Nulmeting (#51) en de reparaties erna (#52) gemerged op 2026-11-04.**
- **Eerder op 2026-11-04 gemerged:** V3 helemaal (P19.2–19.6, #30–#34), de briefs P23/P24 (#36),
  Zod 4 (#38), P23.1 + 23.2 (#42), schermteksten en routes per onderdeel (#45) en P25 "welke tool
  bij welke stap" (#46).
- **Eerlijke bronvermelding (#64) gemerged op 2026-11-04:** bij elf boektools staat nu de echte
  boekprompt als origineel, met de auteurs en pagina's zoals gedrukt. Daarmee is P24.0 klaar.
- **React Router 8 en React 19.3 (#65) gemerged op 2026-11-04:** `npm run dev` start zonder
  waarschuwingen; `meta` en `useMatches` lezen `loaderData`. `vite-node` viel daarbij weg (#68).
- **Begeleide reflectie v2 (#63) gemerged op 2026-11-04:** de drie fasen van Backward Design uit
  het boek, eerst aanscherpen bij vage invoer; gemiddeld 3,4 → 4,8 (`evals/reports/2026-11-04l.md`).
- **Dialogisch gesprek v2 (#62) gemerged op 2026-11-04:** het interview uit het boek; gemiddeld
  3,0 → 4,1 (`evals/reports/2026-11-04i.md`).
- **MentorAI v2 (#61) gemerged op 2026-11-04:** de leermeester uit het boek, met eerlijke
  bronvermelding; gemiddeld 2,5 → 3,4 (`evals/reports/2026-11-04f.md`).
- **P25.4 kader-extractie (#59) en P23.3 rubric invullen in batches (#60) gemerged op
  2026-11-04;** na #60 `npm run db:migrate` (migratie 0013).
- **Strengere meting (#56) gemerged op 2026-11-04:** drie runs per case, harde ja/nee-checks met
  een plafond, een afgekapt antwoord hooguit een 3; Begeleide reflectie 12288 tokens. Nulmeting d:
  `evals/reports/2026-11-04d.md`.
- **Tweede meting (#54), P24.1 (#53) en lege antwoorden (#55) gemerged op 2026-11-04:** Stage
  Assessment heet nu "Studentwerk beoordelen en feedback geven"; Claude 5.5 krijgt extra denkruimte,
  zodat een antwoord niet meer leeg blijft of halverwege ophoudt.
- **P24.0c en 24.0b gemerged op 2026-11-04 (#49, #50):** het originele document naast de tekst
  voor de AI, en anonimiseren vóór het versturen.
- **P25 PR B (#41) en de Word-export (#40) gemerged op 2026-11-04:** de werkplaats is te gebruiken
  zonder AI, met export naar Word.
- **P25 PR A (#39) gemerged op 2026-11-04:** het dossier en de opslag van de BDB/BKE-werkplaats;
  migratie 0011 gedraaid.
- **V2 (P18) klaar en uitgerold op 2026-11-04:** PR's #17, #19, #21–#28; migraties 0009 en 0010 gedraaid; back-up `data/limeonit-voor-p18.db`; superbeheerder ingesteld.

## Verzoeken

- 2026-11-03: "Haal weg wat overbodig is. Als we het op een eenvoudigere en efficiëntere en
  doeltreffendere manier kunnen bouwen, dan ben ik daar een voorstander van." → vereenvoudiging
  V1–V3 hieronder.
- 2026-11-03: "Ik denk wel dat de admin modellen moet kunnen toewijzen … per instelling en kan de
  admin dat per docent overrulen." → onderdeel van V2.
- 2026-11-04: "welke tools we nog meer kunnen maken/aanbieden … Wat missen we allemaal?" →
  onderzoek (Claude Doc, 2026-11-04). Daarna: "nuttige tools … die geen LLM nodig hebben" en "Ja geef
  ze een eigen plek" → BESLUIT-2026-11-04-5, brief P23. Daarna: tools 1 t/m 8 en eerst de nulmeting →
  BESLUIT-2026-11-04-7, brief P24.
- 2026-11-03: "Ik wil ook niet bij beheer op elke tabel regel een opslaan knop hebben. Of eentje
  onderop, of hij slaat automatisch op" → V2: automatisch opslaan met melding.
- 2026-11-03: "Ik mis de stageverslagen checker" (hij heet 'Beoordelingsassistent — stage &
  afstuderen' en was onvindbaar) → V3: duidelijkere toolnamen.
- 2026-11-03: "Ik wil een super beheerder. Dat ben ik. Die kan andere beheerders aanmaken en alles.
  Beheerders kunnen geen andere beheerders aanmaken." → V2 (P18.6).
- 2026-11-03: "Ik wil als superbeheerder ook users kunnen aanmaken zonder email verzoek" → V2
  (P18.7).
- 2026-11-03: "Ook dat wil ik kunnen doen. Resetten, wachtwoord link versturen en zelf een
  wachtwoord invoeren. Ook user account op non-actief kunnen zetten" → V2 (P18.7).
- 2026-11-04: "Hoe kunnen we beginnende docenten begeleiden om hun BDB en BKE goed te maken en
  makkelijk voor ze maken? Ik vind dat we met deze tool de BDB en BKE binnen een paar dagen moeten
  kunnen afronden en wederom met een hele hoge kwaliteit." → brief P25 (werkplaats).
- 2026-11-04: "Voor de BDB/BKE denk ik dat we een dedicated deel van de applicatie hieraan moeten
  wijden." → BESLUIT-2026-11-04-11.
- 2026-11-04: "Maak het ook mogelijk om te importeren van tools als TestVision, ANS, Remindo" → BESLUIT-2026-11-04-16, vervolg op P25.
- 2026-11-05: "Kunnen we niet alvast beginnen met de volgende P20 features?" en "Ik wil 2 t/m 5 wel
  hebben" → P20 met studielast en de P24-tools erbij; toetsmatrijs, OER-import en BDB/BKE naar P26
  (BESLUIT-2026-11-05-1).
- 2026-11-05: "Hoe kunnen we deze applicatie super effectief maken en een genot om mee te werken?",
  "voor de BDB/BKE functie zoveel mogelijk integratie van de tools en wellicht ook een aparte
  workflow" en "alle drie aanbieden?" → document "LimeOnIt als één workflow", BESLUIT-2026-11-05-4,
  brief P27.
- 2026-11-05: "Ik vind dat het gebruikersmanagement in beheer veel beter kan … teams kunnen aanmaken
  van meerdere collega docenten … per team features aan en uit" → document "Teams, privacy en
  gebruikersbeheer", BESLUIT-2026-11-05-5, brief P28.

## Bezig

- Toetsvragen, vaste vraagindeling in code: de app rekent uit de toetsmatrijs per vraag de rij,
  het denkniveau, de vraagvorm en de punten uit en geeft die lijst aan stap 2
  (`test-items-items@v2`, derivatie `question-plan`); elke meerkeuzevraag krijgt vier opties.
  Pakt het punt onder Later aan (metingen t en u). Eindmeting v: vijf cases 4,60–4,93, statistics
  3,26 door één afgekapt antwoord en één harde check (t-waarde niet uit de leerstof). Laatste
  ronde (Bastiaan, 2026-11-05): stap 2 krijgt 32000 tokens, en een tabelwaarde staat als "Gegeven"
  in de vraag. PR open.
- Wankele toast-test: `tests/lib/useFormToast.test.tsx` faalde soms onder zware belasting (de
  toast verdwijnt een tik na de nieuwe pagina); de test wacht daar nu op. Alleen een test. PR open.
- Lastig gesprek, vaste student (`difficult-conversation@v2`): de gespeelde student wisselde soms
  van "haar" naar "zijn" in de gebaren (#75). De gebaren staan nu in de ik-vorm (*ik kijk naar de
  grond*); nieuwe geteld check `mixedPronouns` in de eval. Meting dc4 (3 runs): elke case
  4,67–4,93, geen gefaalde check, alle 198 gebaren in de ik-vorm. PR open.
- P29.2 Proefassessment, de AI-tekst en de meting: `portfolio-rehearsal@v1` (NL/EN) speelt een
  commissie van twee assessoren die het dossier las, één vraag per beurt, dunste criterium eerst,
  doorvragen volgens STARR; op "Rond af" feedback per criterium als JSON. Controle in code
  (`rehearsal.ts`): citaten alleen uit wat de docent typte, onbekende bronnen eruit, nooit een
  cijfer. Bewijsstukken gaan alleen als titel mee. Meting `npm run eval:rehearsal` met vier
  synthetische dossiers; nog niet gedraaid (geen API-sleutel in deze sessie). Geen UI. PR open.
- P27.4 De cursus als werkplek: bij elke les, toets en leeruitkomst knoppen naar de passende
  tools (`Tool.courseActions`), ook per regel van de week op Start; "Los op met…" bij
  aandachtspunten en pet-adviezen (`FINDING_TOOLS`); op de cursuspagina "Per week". Een knop
  opent de tool met cursus en onderdeel, en het resultaat komt bij dat onderdeel. Plus de
  documentatie van P27 (27.5). Geen migratie. PR open.
- Rolagenten aan en uit in beheer: een eigen pagina `/admin/agents` (menu *Rolagenten*) met de
  hoofdschakelaar (dezelfde als bij Onderdelen, Aan / Op aanvraag / Uit) en per pet Aan of Uit
  voor de hele instantie. Een pet die uit staat, draait niet, staat niet op de cursuspagina en telt
  niet mee bij de open adviezen op Start; zijn oude adviezen blijven bewaard. Staan alle petten
  uit, dan verdwijnt "Beoordeling". De uitleg op de cursuspagina noemt nu de petten die aan staan.
  Opslag in `instance_settings` (`agentStand:<id>`), geen migratie. PR open.
- Beheer sneller, tools: op `/admin/tools` zoeken op naam, filteren op stand (Aan / Op aanvraag /
  Uit) en "Zet alle getoonde tools op …" in één klik. Geen migratie. PR open.
- P21.7 + 21.8 Rolagenten, gekoppeld werk en documentatie: een vinkje "Ook de gekoppelde
  toetsvragen nakijken" bij "Laat beoordelen" (standaard uit, alleen als er toetsvragen gekoppeld
  zijn). De Toetsdeskundige krijgt dan de eigen gekoppelde toetsvragen mee en draait op
  `agent-assessment@v2`; eval-casus "toets op te laag niveau" erbij. AGENTS.md, wiki en brief
  bijgewerkt. Meting v2 (claude-sonnet-5-5): ra2 11/11, ra3 33/33 geslaagd. PR open.
- Brief P28 Teams, delen en efficiënt gebruikersbeheer: alleen tekst, PR open (BESLUIT-2026-11-05-5).
- P22.4 + 22.5 De week van de docent, agenda en documentatie: "Zet in je agenda" op de cursus
  (`/courses/:id/calendar.ics`, alleen de eigenaar, met vaste UID per onderdeel), het
  helponderwerp "Je week" en de wiki. Daarmee is P22 af, op de toolknoppen na (wachten op P27.4).
  PR open.
- P28.3 Onderdelen, tools en modellen per team: per tool en per onderdeel de stand Uit / Aan /
  Op aanvraag (`/admin/tools`), per team aan / uit / geen keuze en een eigen modelset (beheerder en
  teamleider), uitzonderingen per docent op de persoonspagina met "waar komt het vandaan".
  Cursussen en hulpmiddelen zijn een 404 als ze uit staan. Migraties 0016 en 0017. PR open.

- P27.3 Start en een menu van vier: een docent landt op `/start` met het vraagvak "Waar wil je
  mee aan de slag?" (hooguit drie tools, zelfde zoekfunctie als de catalogus, met de gekozen cursus
  in de link), *Deze week* (open aandachtspunten en laatst gemaakt werk) en je cursussen. Menu:
  Start · Cursussen · BDB/BKE · Tools (+ Beheer). "Mijn werk" heet nu "Eerder gemaakt",
  Onderwijscontext zit in het accountmenu, Help is een vraagteken rechtsboven. Geen route weg,
  geen migratie. PR open.

- P27.1 Volgende stap onder elk resultaat: twee of drie logische vervolgtools (data in het
  register, `Tool.next`), "Bewaar bij cursus" en "Gebruik als bewijs" (met criterium) direct onder
  het resultaat, ook bij meerfasige tools en gesprekken. Een vervolgtool opent met dezelfde cursus
  (`?course=`). Toetsvragen kreeg zo ook de cursuskiezer. PR open.
- Word-tabellen in de export: een cursus als bewijs (P26.4) komt in de Word-export van het
  dossier als echte tabel met kopregel en eigen kopjes onder de bijlage, niet meer als tekst met
  streepjes. Geplakt bewijs blijft letterlijk. PR open.


## Wacht op jou

- **Foto voor Wiskunde nakijken:** een echte foto van handgeschreven werk (zonder naam) als
  `evals/math-grading/fixtures/handwritten-derivative.png`; zonder foto meet de eval deze tool niet.

## Volgende (volgorde gekozen door Bastiaan, 2026-11-04)

Klaar: V1 (P17), V2 (P18), V3 (P19), P23.1–23.3, P24.0b/0c/1, P25.1–25.6.

1. **P24.0 afmaken** (spoor A, achter elkaar): meting d → MentorAI v2 (klaar) → Dialogisch gesprek (klaar) →
   Begeleide reflectie (klaar) → de andere tools (bronvermelding, klaar), elk een PR met meting ervoor en erna (BESLUIT-2026-11-04-23).
2. **P24.2–24.8, de nieuwe AI-tools**: na #56, eerst 24.2 (beoordelingsmodel) en 24.3
   (toetsvragen en toetsmatrijs); hooguit twee tegelijk.
3. **P20** (cursussen), dan **P26.3** (OER-import), dan **P27.1 + 27.2** (volgende stap,
   BDB/BKE doet mee), dan **P28.1–28.3** (gebruikersbeheer, teams, aan/uit per team), dan **P27.3** (Start en menu), **P21** (rolagenten) en **P27.4**, dan **P22**
   (de docentweek, op Start), dan **P28.4–28.5** (delen, meerdere tegelijk), dan de rest van **P26** (BESLUIT-2026-11-05-4, -5).

## Open vragen

- De privacy-officer kijkt later mee naar het anonimiseren (24.0b, BESLUIT-2026-11-04-20).
- De privacy-officer kijkt later mee naar het rubric-invullen in batches (P23.3, BESLUIT-2026-11-04-8).

## Later (bewust geparkeerd)

- Toetsvragen, bekende punten: af en toe een correctiespoor in een kop van het antwoordmodel en
  soms 3 opties bij statistiek. Oplossing in code (vaste rijtoewijzing per vraag), niet met
  prompttekst; twee rondes prompttekst hielpen niet (metingen t en u).
- Add-on **praktijksimulaties** (Webshop Bob, fotorealistische avatars).
- Spraak (dicteren, voorlezen).
- De studentenlaag, opnieuw en beter.
- Het evaluatie-harnas: de nulmeting is nog nooit gedraaid.
- Flash-toasts na een redirect (stub P16).
