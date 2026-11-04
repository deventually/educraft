# Fabrieksbord

> Het bord van de Producer. Een werker werkt het bij **in dezelfde PR** als zijn werk. Een lege sectie
> blijft leeg. Kort houden: dit is een bord, geen archief. Geschiedenis staat in `geschiedenis.md`,
> `docs/implementation/README.md` en git.

_Laatst bijgewerkt: 2026-11-04 (V2 (P18) klaar en uitgerold)_

## Nu

- **Product:** LimeOnIt, docententools op basis van *The Pedagogical Promptbook*: 15 tools (9 voor
  docenten, 6 tutors), tweetalig NL/EN, gericht op hbo.
- **Gebruik:** pilot met een aantal docenten en leden van een examencommissie.
- **Stack:** React Router 7, SQLite (Drizzle), AI SDK (standaard Claude Sonnet 5.5) + lokale modellen,
  Vitest + axe. 878 tests, CI groen op `main`.
- **Laatst op `main` (2026-11-03):** V1 (P17) gemerged en uitgerold: de studentenlaag is eruit en de
  studentdata is gewist; de back-up van vóór de migratie wordt op 2026-11-10 verwijderd. Eerder: P15
  (toasts, navigatie-toegankelijkheid), Claude 5.5-modellen, documenten tot 300k tekens, briefs
  P20–P22, de fabriek.
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

- Kwetsbaarheden in npm-pakketten: 26 → 5 (React Router, Vite, Vitest, happy-dom en indirecte pakketten bijgewerkt). Zod 3 → 4 volgt in #38 (gekozen 2026-11-04).
- Briefs P23 (hulpmiddelen zonder AI) en P24 (acht AI-tools), BESLUIT-2026-11-04-5 t/m -10 — PR #36
  open, wacht op Bastiaan.
- Brief P25 (BDB/BKE-werkplaats), PR #37.
- V3 stappen 19.2 t/m 19.6 — vijf PR's op een rij (#30 en de vier erna), op volgorde mergen.

## Wacht op jou

- Brief P25 (BDB/BKE-werkplaats) mergen, PR #37.

## Volgende (voorgestelde volgorde)

0. **Hulpmiddelen zonder AI** (brief P23): de plek, de cijferrekenaar, rubrics bewaren en invullen.
   Drie PR's. Klein en zonder risico, kan naast de rest.
0. **Acht nieuwe AI-tools** (brief P24): eerst de nulmeting (24.0, Bastiaan draait hem), dan één PR
   per tool met een meetbare kwaliteitslat.

1. **Vereenvoudiging V1** (brief P17): klaar, gemerged en uitgerold op 2026-11-03.
2. **Vereenvoudiging V2** (brief P18): klaar en uitgerold op 2026-11-04. Het omvatte beheer naar vier pagina's die automatisch
   opslaan; "Bekijk als docent", de land-as en de toegang per docent voor tools en context weg;
   modellen per instelling met een overrule per docent; CLI- en lokale modellen alleen in
   ontwikkelmodus; een superbeheerder; slapende tabellen opruimen. Besluiten: BESLUIT-2026-11-03-14
   t/m -17.
3. **Vereenvoudiging V3** (brief P19, nog vijf PR's): de docentkant. 19.1 (toolnamen, taak eerst;
   BESLUIT-2026-11-03-18) is gemerged. Daarna: 19.2 geen doelgroeplabels, 19.3 techniek achter
   "Geavanceerd", 19.4 lege pagina's die sturen (kunnen naast V2); 19.5 menu en 19.6 kort
   contextformulier kunnen nu ook (18.2 en 18.4 zijn gemerged). Bastiaans keuzes: BESLUIT-2026-11-04-2 t/m -4.
4. **Cursussen en de rode draad:** brief P20.
5. **Rolagenten** (P21), daarna de **docentweek** (P22).
6. **BDB/BKE-werkplaats** (brief P25, **gaat voor**: eerste gebruik deze maand): kortste pad in drie
   PR's, daarna Word-export, kader-extractie en de BKE-onderdelen met de tools uit P23 en P24.

## Open vragen

- Volgorde: eerst de hele vereenvoudiging, of na V1 al cursussen?

## Later (bewust geparkeerd)

- Add-on **praktijksimulaties** (Webshop Bob, fotorealistische avatars).
- Spraak (dicteren, voorlezen).
- De studentenlaag, opnieuw en beter.
- Het evaluatie-harnas: de nulmeting is nog nooit gedraaid.
- Flash-toasts na een redirect (stub P16).
