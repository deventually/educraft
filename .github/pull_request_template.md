## In gewone taal

<!-- Twee à drie zinnen voor Bastiaan, zonder jargon: wat verandert er voor een docent (of voor
Bastiaan), en waarom. -->

## Wat er technisch verandert

-

## Waarom

<!-- Link de brief, het besluit of het verzoek op het bord. -->

## Hoe het getest is

- [ ] `npm test`, `npm run typecheck` en `npm run check` zijn groen
- [ ] De `e2e`-job (browsertests) is groen; staat hij uit (`E2E_IN_CI` = `false`), dan `npm run test:e2e` lokaal met de uitslag, bv. `25 passed`
- [ ] Nieuwe of gewijzigde behaviour heeft eerst een falende test gehad (TDD)
- [ ] UI-wijziging: axe-test, plus screenshots in NL/EN op desktop en mobiel (anders: n.v.t.)
- [ ] `docs/fabriek/STATUS.md` is bijgewerkt

## Wat Bastiaan moet beslissen

<!-- Of: niets. -->
