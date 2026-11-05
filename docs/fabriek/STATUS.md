# Fabrieksbord

> Het bord van de Producer. Een werker werkt het bij **in dezelfde PR** als zijn werk. Een lege sectie
> blijft leeg. Kort houden: dit is een bord, geen archief. Geschiedenis staat in `geschiedenis.md`,
> `docs/implementation/README.md` en git.

_Laatst bijgewerkt: 2026-11-05 (P24.5 gemerged, P24.6 bezig)_

## Nu

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

## Bezig

- P24.6 Opdracht helder schrijven (`clear-assignment`): een opdrachtomschrijving of
  studentenhandleiding herschreven op taalniveau B1 (of A2, B2, C1), met stappen, eisen,
  inleverinfo, open punten ("je noemt geen deadline"), wat er veranderd is en een eisencheck; geen eis
  verdwijnt of komt erbij. Bronnen: ERK (Council of Europe, 2020), UDL 3.0 (CAST, 2024). Zes
  eval-casussen, drie met een bekende fout (ontbrekende info, tegenstrijdige eisen, vage criteria).
  Metingen ca1 → ca2 (ca2: 3 runs, batch): elke case 4,67–5,00, geen gefaalde harde check, niets
  afgekapt, secties altijd in de vaste volgorde (BESLUIT-2026-11-04-24 gehaald;
  `evals/reports/2026-11-05ca2.md`). Tien uitkomsten liggen klaar in `evals/reviews/clear-assignment/`
  voor Bastiaan — PR open.
- P24.8 Lastig gesprek oefenen (`difficult-conversation`, chat): de AI speelt een verzonnen student
  in een gesprek over studieadvies, een onvoldoende, een vermoeden van fraude of een student die
  vastloopt, en geeft op "Geef feedback" feedback met letterlijke citaten van de docent. Slecht
  nieuws volgt SPIKES (Baile e.a., 2000, gecontroleerd); de rest algemene gesprekstechniek. Vijf
  eval-casussen van acht beurten plus feedback, twee met een bekende fout. Meting dc1 (1 run, batch):
  4,20–4,80, geen harde check gefaald, niets afgekapt; zwakste punt vetgedrukte labels in de
  feedback. Ronde 1: gewone opsommingstekens en genderneutraal ook in non-verbale aanwijzingen;
  eindmeting dc2 (3 runs) volgt — PR open.

## Wacht op jou

- **Foto voor Wiskunde nakijken:** een echte foto van handgeschreven werk (zonder naam) als
  `evals/math-grading/fixtures/handwritten-derivative.png`; zonder foto meet de eval deze tool niet.

## Volgende (volgorde gekozen door Bastiaan, 2026-11-04)

Klaar: V1 (P17), V2 (P18), V3 (P19), P23.1–23.3, P24.0b/0c/1, P25.1–25.6.

1. **P24.0 afmaken** (spoor A, achter elkaar): meting d → MentorAI v2 (klaar) → Dialogisch gesprek (klaar) →
   Begeleide reflectie (klaar) → de andere tools (bronvermelding, klaar), elk een PR met meting ervoor en erna (BESLUIT-2026-11-04-23).
2. **P24.2–24.8, de nieuwe AI-tools**: na #56, eerst 24.2 (beoordelingsmodel) en 24.3
   (toetsvragen en toetsmatrijs); hooguit twee tegelijk.
3. **P20** (cursussen en de rode draad), dan **P21** (rolagenten), dan **P22** (de docentweek).

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
