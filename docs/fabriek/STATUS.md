# Fabrieksbord

> Het actuele overzicht voor het kantoor (Claude-project). **De werkplaats (Claude Code) werkt dit
> bij aan het eind van elke fase.** Kort houden: dit is een bord, geen archief. Geschiedenis staat in
> `docs/implementation/README.md` en git.

_Laatst bijgewerkt: 2026-11-03_

## Nu

- **Product:** LimeOnIt, docententools op basis van *The Pedagogical Promptbook*: 15 tools (9 voor
  docenten, 6 tutors), tweetalig NL/EN, gericht op hbo.
- **Gebruik:** pilot met een aantal docenten en leden van een examencommissie.
- **Stack:** React Router 7, SQLite (Drizzle), AI SDK (Claude) + lokale modellen, Vitest + axe.
  Ongeveer 23.500 regels app en 15.400 regels tests (1.013 tests, groen).

## Werk in uitvoering

- **Branch `p15-user-feedback-toasts-a11y`:** P15 (toasts + navigatie-a11y) is gecommit, nog niet
  gemerged. Daarnaast staan er niet-gecommitte wijzigingen die **niet** bij P15 horen:
  1. **Modelupgrade:** Claude Sonnet 5.5 en Opus 5.5 in de catalogus; standaard en alle tools →
     Sonnet 5.5.
  2. **Grotere documenten:** een `document`-veld mag 300k tekens bevatten (was 20k), met een
     duidelijke foutmelding.
  3. **Docs:** P17–P19 (cursussen, rolagenten, docentweek, nog Engels) en `docs/fabriek/`.

## Volgende (voorgestelde volgorde)

1. **P15 afronden:** de losse wijzigingen apart committen, daarna mergen.
2. **Vereenvoudiging V1:** de studentenlaag eruit; de tutors blijven voor docenten.
3. **Vereenvoudiging V2:** beheer van acht naar vier pagina's; land-as en toegang per docent voor
   tools en context weg; modellen per instelling met overrule per docent.
4. **Vereenvoudiging V3:** de docentkant: menu, toolnamen (taak eerst), toolpagina, kort
   contextformulier, lege pagina's die sturen.
5. **Cursussen en de rode draad** (nu brief P17, wordt hernummerd en vertaald).
6. **Rolagenten** (stub P18), daarna **docentweek** (stub P19).

## Open vragen

- Toolnamen: taak als titel en boek als ondertitel, of de boeknamen zichtbaarder houden?
- Volgorde: eerst de hele vereenvoudiging, of na V1 al cursussen?

## Later (bewust geparkeerd)

- Add-on **praktijksimulaties** (Webshop Bob, fotorealistische avatars).
- Spraak (dicteren, voorlezen).
- De studentenlaag, opnieuw en beter.
