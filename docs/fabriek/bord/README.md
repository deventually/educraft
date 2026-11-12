# Het bord: wat er gemerged is

Elke PR zet hier **één nieuw bestand** neer met wat er voor een docent of voor Bastiaan verandert.
Een nieuw bestand botst nooit met een andere PR; zo geeft het bord geen merge-conflicten meer
(BESLUIT-2026-11-12-16).

- **Naam:** `<datum>-<onderwerp>.md`, bijvoorbeeld `2026-11-12-mijn-begeleiding-lijst.md`. Kleine
  letters, cijfers en streepjes. De datum is de dag waarop je de PR opent; zo staat de map op
  volgorde.
- **Inhoud:** één punt (of een paar) in de vorm van het bord, in gewone taal, met het
  PR-nummer zodra je dat weet:

  ```markdown
  - **Mijn begeleiding: de lijst en het traject (P38.2, #323):** onder *Mijn begeleiding* opent
    een docent een traject per student, ziet de voortgang en de volgende mijlpaal.
  ```

- **Alleen je eigen bestand.** Pas geen bestand van een andere PR aan en schrijf niet in
  `STATUS.md` voor je eigen werk.
- Staat het bestand op `main`, dan is het gemerged. Wat nog loopt, staat in de
  [open PR's](https://github.com/deventually/educraft/pulls); daar hoeft niets voor op het bord.

[`2026-11-12-eerder.md`](2026-11-12-eerder.md) bevat alles wat tot en met #322 gemerged is, het
nieuwste bovenaan. `tests/hotspots.test.ts` bewaakt de namen en de vorm.

**Samenvoegen** gebeurt bij elke release: de release-PR zet alle losse bestanden in één bestand
`<datum>-release-X-Y-Z.md` en haalt de losse weg. Dat botst niet, want open PR's voegen alleen
nieuwe bestanden toe.
