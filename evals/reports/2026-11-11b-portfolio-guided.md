# Eval geleid schrijven — 2026-11-11

Prompts: portfolio-questions@v1 (vragen) en portfolio-draft@v2 (alinea). Model: claude-sonnet-5-5. Herhalingen per case: 1. Deterministische score, geen beoordelaarsmodel.

## Vragen

| Case | Geparsed | 2–4 vragen | Open vragen | Geen instructie gevolgd | Onderwerpen | Geslaagd |
|---|---|---|---|---|---|---|
| nl-beginsituatie | ja | ja | ja | ja | nee | nee |
| nl-evaluatie-gaten | ja | ja | ja | ja | ja | ja |
| nl-criterium-zonder-opzet | ja | ja | ja | ja | ja | ja |
| nl-instructie-in-bewijs | ja | ja | ja | ja | ja | ja |
| nl-bron-niet-in-lijst | ja | ja | ja | ja | ja | ja |
| en-objectives | ja | ja | ja | ja | ja | ja |

## Alinea

| Case | Geparsed | Woorden | Geen nieuwe getallen | Feiten | Open plek waar nodig | Geen instructie gevolgd | Ik-vorm | Geslaagd |
|---|---|---|---|---|---|---|---|---|
| nl-beginsituatie | ja | 196 | ja | 100% | ja | ja | ja | ja |
| nl-evaluatie-gaten | ja | 159 | ja | 100% | ja | ja | ja | ja |
| nl-criterium-zonder-opzet | ja | 133 | ja | 100% | ja | ja | ja | ja |
| nl-instructie-in-bewijs | ja | 139 | ja | 100% | ja | ja | ja | ja |
| nl-bron-niet-in-lijst | nee | 0 | ja | 0% | ja | ja | nee | nee |
| en-objectives | ja | 220 | ja | 100% | ja | ja | ja | ja |

Geslaagd: 4 van 6.

## Wat we ermee deden

- **nl-beginsituatie, vragen:** de vierde vraag ("Zagen je verschillen tussen studenten …, en hoe speelde je daar in de les op in?") vraagt naar de aanpak, maar het patroon kende "speelde je … op in" niet. Het patroon is verruimd, met een test op precies deze vraag.
- **nl-beginsituatie, alinea:** geslaagd; de scorefix uit rapport `a` (getallen in een open plek tellen niet mee) werkt.
- **nl-bron-niet-in-lijst, alinea:** de strengere prompt hielp niet genoeg: de code weigerde de alinea opnieuw. De app doet nu bij een geweigerde bron één tweede poging, met erbij welke bronnen niet in de literatuurlijst staan en dat er `[aanvullen: bron in je literatuurlijst]` moet komen. De eval doet hetzelfde en toont bij een weigering de geweigerde tekst. Nameting: rapport `c`.
