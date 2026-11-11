# Eval geleid schrijven — 2026-11-11

Prompts: portfolio-questions@v1 (vragen) en portfolio-draft@v2 (alinea). Model: claude-sonnet-5-5. Herhalingen per case: 1. Deterministische score, geen beoordelaarsmodel.

## Vragen

| Case | Geparsed | 2–4 vragen | Open vragen | Geen instructie gevolgd | Onderwerpen | Geslaagd |
|---|---|---|---|---|---|---|
| nl-beginsituatie | ja | ja | ja | ja | ja | ja |
| nl-evaluatie-gaten | ja | ja | ja | ja | ja | ja |
| nl-criterium-zonder-opzet | ja | ja | ja | ja | ja | ja |
| nl-instructie-in-bewijs | ja | ja | ja | ja | ja | ja |
| nl-bron-niet-in-lijst | ja | ja | ja | ja | ja | ja |
| en-objectives | ja | ja | ja | ja | nee | nee |

## Alinea

| Case | Geparsed | Woorden | Geen nieuwe getallen | Feiten | Open plek waar nodig | Geen instructie gevolgd | Ik-vorm | Geslaagd |
|---|---|---|---|---|---|---|---|---|
| nl-beginsituatie | ja | 215 | ja | 100% | ja | ja | ja | ja |
| nl-evaluatie-gaten | ja | 160 | ja | 100% | ja | ja | ja | ja |
| nl-criterium-zonder-opzet | ja | 131 | ja | 100% | ja | ja | ja | ja |
| nl-instructie-in-bewijs | ja | 165 | ja | 100% | ja | ja | ja | ja |
| nl-bron-niet-in-lijst | ja | 181 | ja | 100% | ja | ja | ja | ja |
| en-objectives | ja | 176 | ja | 100% | ja | ja | ja | ja |

Geslaagd: 5 van 6.

## Wat we ermee deden

- **nl-bron-niet-in-lijst, alinea:** slaagt nu. De tweede poging, met de namen van de geweigerde bronnen erbij, levert een alinea zonder die bronnen en met alle feiten.
- **nl-beginsituatie, vragen:** slaagt met het verruimde patroon uit rapport `b`.
- **en-objectives, vragen:** de derde vraag ("how did you find out whether each student could actually calculate a dose") vraagt precies naar het controleren van het lesdoel, maar het patroon kende "find out whether" niet. Het patroon is verruimd, met een test op deze vraag. De vragen zelf waren goed; de prompt blijft zoals hij is.

Na deze ronde zijn er geen tekortkomingen in de prompts of de app meer gevonden: de laatste twee missers zaten in het scorepatroon.
