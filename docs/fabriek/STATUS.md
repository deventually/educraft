# Fabrieksbord

> Het bord van de Producer. Een werker werkt het bij **in dezelfde PR** als zijn werk. Een lege sectie
> blijft leeg. Kort houden: dit is een bord, geen archief. Geschiedenis staat in `geschiedenis.md`,
> `docs/implementation/README.md` en git.

_Laatst bijgewerkt: 2026-11-03 (V2 stap 18.8: opruimen van slapende tabellen en kolommen)_

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

## Verzoeken

- 2026-11-03: "Haal weg wat overbodig is. Als we het op een eenvoudigere en efficiëntere en
  doeltreffendere manier kunnen bouwen, dan ben ik daar een voorstander van." → vereenvoudiging
  V1–V3 hieronder.
- 2026-11-03: "Ik denk wel dat de admin modellen moet kunnen toewijzen … per instelling en kan de
  admin dat per docent overrulen." → onderdeel van V2.
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

## Bezig

- V2 stap 18.2: toegang per docent en land-as weg — deze PR.
- V2 stap 18.3: modellen als overrule per docent — PR (bovenop 18.2).
- V2 stap 18.4: vier beheerpagina's — PR (bovenop 18.3).
- V2 stap 18.5: automatisch opslaan in beheer, geen opslaan-knoppen meer — branch `claude/p18-5` (bovenop 18.4).
- V2 stap 18.6: superbeheerder — alleen hij maakt, degradeert en verwijdert beheerders; uitnodigingen maken nooit beheerders; `npm run set-owner` — branch `claude/p18-6` (bovenop 18.5).
- V2 stap 18.7: superbeheerder maakt accounts direct aan (link of beginwachtwoord), stelt wachtwoorden in en zet accounts op non-actief; migratie `0009` (kolom erbij) — branch `claude/p18-7` (bovenop 18.6).
- V2 stap 18.8: opruimen — tabellen `chat_sessions`/`messages`/`projects` en kolommen `allowed_tool_slugs`/`project_id` weg, oude instellingen en open beheerdersuitnodigingen gewist (destructieve migratie `0010`, eerst back-up) — branch `claude/p18-8` (bovenop 18.7).
- V2 stap 18.9: wie van rol wisselt (docent ↔ beheerder) wordt overal uitgelogd (`setUserRole` verhoogt `sessionVersion`) — branch `claude/p18-9` (bovenop 18.8).

## Wacht op jou

## Volgende (voorgestelde volgorde)

1. **Vereenvoudiging V1** (brief P17): klaar, gemerged en uitgerold op 2026-11-03.
2. **Vereenvoudiging V2** (brief P18, acht PR's): beheer naar vier pagina's die automatisch
   opslaan; "Bekijk als docent", de land-as en de toegang per docent voor tools en context weg;
   modellen per instelling met een overrule per docent; CLI- en lokale modellen alleen in
   ontwikkelmodus; een superbeheerder; slapende tabellen opruimen. Besluiten: BESLUIT-2026-11-03-14
   t/m -17.
3. **Vereenvoudiging V3** (wordt P19): de docentkant. Stap 19.1 (toolnamen, taak eerst; besluit
   BESLUIT-2026-11-03-18) is gemerged. Nog te doen: menu, toolpagina (techniek achter
   "Geavanceerd"), een kort contextformulier, lege pagina's die sturen; de stageverslagen-checker
   heet nu 'Stageverslag of afstudeerwerk beoordelen'.
4. **Cursussen en de rode draad:** brief P20.
5. **Rolagenten** (P21), daarna de **docentweek** (P22).

## Open vragen

- Toolnamen: taak als titel en boek als ondertitel, of de boeknamen zichtbaarder houden?
- Volgorde: eerst de hele vereenvoudiging, of na V1 al cursussen?

## Later (bewust geparkeerd)

- Add-on **praktijksimulaties** (Webshop Bob, fotorealistische avatars).
- Spraak (dicteren, voorlezen).
- De studentenlaag, opnieuw en beter.
- Het evaluatie-harnas: de nulmeting is nog nooit gedraaid.
- Flash-toasts na een redirect (stub P16).
