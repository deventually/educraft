# Releases

Elke uitgebrachte versie van LimeOnIt, de nieuwste bovenaan, met de datum waarop hij uitkwam.
Per versie een paar regels in gewone taal: wat er verandert voor een docent, en wat wie de server
beheert moet doen (een migratie, een nieuwe instelling in `.env`).

Versienummers volgen [SemVer](https://semver.org/lang/nl/) (BESLUIT-2026-11-11-5):

- **Major** (`2.0.0`): wie LimeOnIt zelf installeert, moet iets met de hand doen voordat de nieuwe
  versie werkt, bijvoorbeeld een nieuwe verplichte instelling.
- **Minor** (`1.3.0`): iets nieuws voor docenten of beheer. Een migratie die vanzelf loopt, hoort
  hier ook bij.
- **Patch** (`1.2.1`): alleen herstel, geen nieuwe mogelijkheden.

Een release maken staat in [`docs/overdracht.md`](docs/overdracht.md#3-deployen). Elke versie
krijgt een kop in precies deze vorm, anders weigert de release-workflow de tag:

```text
## [1.2.0] - 2026-11-12
```

Nog geen versie uitgebracht.
