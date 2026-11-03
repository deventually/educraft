# De LimeOnIt-fabriek

LimeOnIt wordt gestuurd als een kleine softwarefabriek:

```
 KANTOOR (Claude-project)            LOPENDE BAND                 WERKPLAATS (Claude Code)
 threads = werkorders        ──▶   docs/implementation/Pn.md  ──▶   bouwt test-first
 KOERS · IDEE · BRIEF ·                                              volgens AGENTS.md
 REVIEW · BUG · PILOT ·      ◀──   eindrapport + STATUS.md    ◀──   werkt het bord bij
 DIDACTIEK
```

| Bestand | Wat |
| --- | --- |
| [`project-instructies.md`](project-instructies.md) | De instructies voor het Claude-project (plakken) |
| [`STATUS.md`](STATUS.md) | Het fabrieksbord: wat er nu is, wat er loopt, wat de volgende stap is |
| [`besluiten.md`](besluiten.md) | Het besluitenlog: één regel per besluit |
| [`geschiedenis.md`](geschiedenis.md) | Tijdlijn mei–november 2026 en de lessen; achtergrond, geen instructie |

## Het project inrichten (eenmalig)

1. Maak op claude.ai een project **LimeOnIt** aan.
2. Plak bij **Instructies** alles onder de streep uit `project-instructies.md`.
3. Voeg bij **Projectkennis** via GitHub de repo `deventually/educraft` toe, en selecteer alleen:
   - `docs/fabriek/` (bord, besluiten)
   - `AGENTS.md`
   - `docs/VISION.md`
   - `docs/implementation/README.md`
   - `wiki/Architecture.md`, `wiki/Context-Model.md`, `wiki/Tools.md`

   Niet de hele repo: dan verdrinkt het kantoor in code die de werkplaats beter kan lezen.
4. Klik na elke merge in de werkplaats op **sync** bij de GitHub-kennis, zodat het bord actueel is.

## Een werkorder draaien

1. Start een thread met het type als eerste woord, bijvoorbeeld:
   - `KOERS wat pakken we deze week op?`
   - `IDEE spraak voor docenten`
   - `BRIEF vereenvoudiging V1: studentenlaag eruit`
2. Eindigt de thread met een brief, plak dan de startprompt in een nieuwe Claude Code-sessie in deze
   repo.
3. Plak het eindrapport van de werkplaats in een `REVIEW`-thread, of in de thread waar de brief
   vandaan kwam.
4. Neem de regels uit **Overdracht → Besluiten** over in `besluiten.md`, of laat de werkplaats dat
   doen.
