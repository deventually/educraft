# Fabrieksbord

> Het bord van de Producer. Een werker werkt het bij **in dezelfde PR** als zijn werk. Een lege sectie
> blijft leeg. Kort houden: dit is een bord, geen archief. Geschiedenis staat in `geschiedenis.md`,
> `docs/implementation/README.md` en git.

_Laatst bijgewerkt: 2026-11-03 (V1 stap 17.1)_

## Nu

- **Product:** LimeOnIt, docententools op basis van *The Pedagogical Promptbook*: 15 tools (9 voor
  docenten, 6 tutors), tweetalig NL/EN, gericht op hbo.
- **Gebruik:** pilot met een aantal docenten en leden van een examencommissie.
- **Stack:** React Router 7, SQLite (Drizzle), AI SDK (standaard Claude Sonnet 5.5) + lokale modellen,
  Vitest + axe. 1.013 tests, CI groen op `main`.
- **Laatst op `main` (2026-11-03):** P15 (toasts, navigatie-toegankelijkheid), Claude 5.5-modellen,
  documenten tot 300k tekens, briefs P20–P22, de fabriek.

## Verzoeken

- 2026-11-03: "Haal weg wat overbodig is. Als we het op een eenvoudigere en efficiëntere en
  doeltreffendere manier kunnen bouwen, dan ben ik daar een voorstander van." → vereenvoudiging
  V1–V3 hieronder.
- 2026-11-03: "Ik denk wel dat de admin modellen moet kunnen toewijzen … per instelling en kan de
  admin dat per docent overrulen." → onderdeel van V2.

## Bezig

- V1 stap 17.1: mentorinzicht eruit — deze PR.

## Wacht op jou

## Volgende (voorgestelde volgorde)

1. **Vereenvoudiging V1** (brief P17, drie PR's): de studentenlaag eruit (rol, cohorten,
   studentuitnodigingen, mentorinzicht, verwijderverzoek, vergrendelde modus, één actieve sessie).
   De zes tutors blijven, voor docenten. Bastiaan 2026-11-03: studentdata definitief wissen;
   uitloggen na een nieuw wachtwoord houden (17.2 houdt `sessionVersion` en verhoogt hem alleen bij
   reset en wachtwoordwijziging, zie Risico's punt 2).
2. **Vereenvoudiging V2** (wordt P18): beheer van acht naar vier pagina's; de land-as en de
   toegang per docent voor tools en context weg; modellen per instelling met een overrule per
   docent; CLI- en lokale modellen alleen in ontwikkelmodus; "Bekijk als docent" weg.
3. **Vereenvoudiging V3** (wordt P19): de docentkant: menu, toolnamen (taak eerst), toolpagina
   (techniek achter "Geavanceerd"), een kort contextformulier, lege pagina's die sturen.
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
