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

## [1.0.0] - 2026-11-21

De eerste versie van LimeOnIt, de versie waarmee de pilot begint.

**Voor docenten**
- Ruim dertig AI-tools uit *The Pedagogical Promptbook*, in het Nederlands en het Engels: voor
  lessen, opdrachten, toetsvragen, rubrics, feedback en chatgesprekken met studenten. Onder elk
  resultaat staat de volgende stap, en je bewaart het bij een cursus.
- Hulpmiddelen zonder AI, zoals de cijfer- en cesuurrekenaar, de toetsanalyse en kalibreren met
  een tweede beoordelaar.
- Cursussen met leeruitkomsten, activiteiten en toetsen, een toetsmatrijs, het toetsdossier, en
  een reviewteam dat meekijkt en adviseert maar nooit zelf iets verandert.
- De BDB/BKE-werkplaats: je dossier per leeruitkomst, bewijs koppelen, geleid schrijven in je eigen
  stem, *Grill me* en een inleverklaar-check.
- Het stage- en afstudeertraject naast OnStage, en hulp bij studieloopbaanbegeleiding.
- Samenwerken in teams, opleidingen en leerlijnen, en delen met je team.
- Exporteren naar Word, PDF, Excel en PowerPoint, ook met het sjabloon van je school.
- Voordat er iets naar de AI gaat, haalt LimeOnIt namen en nummers weg, en je ziet vooraf wat er
  verstuurd wordt.

**Voor beheer**
- Gebruikers, teams en opleidingen beheren, tools en modellen aan- en uitzetten per instelling,
  team of docent, en een standaardmodel per laag.
- Tweestapsverificatie, verplicht voor beheerders.
- Een gezondheidsscherm (back-up, database, schijfruimte), het logboek en het AI-gebruik met
  kosten.

**Op de server**
- Migratie: ja, ze lopen vanzelf bij het starten. Dit is de eerste versie, dus er is geen eerdere
  versie om naar terug te rollen; `deploy.sh` maakt vóór de update wel een back-up van de database.
- Instellingen: `SESSION_SECRET`, `APP_ORIGIN` en minstens één API-sleutel, zie
  `docs/installatie-docker.md`. Met meer dan één instelling ook `TENANTS`.

