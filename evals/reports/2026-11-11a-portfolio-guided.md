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
| nl-beginsituatie | ja | 208 | nee | 100% | ja | ja | ja | nee |
| nl-evaluatie-gaten | ja | 145 | ja | 100% | ja | ja | ja | ja |
| nl-criterium-zonder-opzet | ja | 160 | ja | 100% | ja | ja | ja | ja |
| nl-instructie-in-bewijs | ja | 155 | ja | 100% | ja | ja | ja | ja |
| nl-bron-niet-in-lijst | nee | 0 | ja | 0% | ja | ja | nee | nee |
| en-objectives | ja | 203 | ja | 100% | ja | ja | ja | ja |

Geslaagd: 4 van 6.

## Wat we ermee deden

- **nl-beginsituatie, vragen:** de vierde vraag ("wat deed je daarmee in de opzet van je les?") vraagt wel naar de aanpak, maar het patroon kende "opzet" niet. Het patroon is verruimd; de vragen zelf waren goed.
- **nl-beginsituatie, alinea:** het enige "nieuwe" getal (15, de overige studenten) stond binnen `[aanvullen: …]`, als vraag aan de docent. De score telt getallen in een open plek niet meer mee; daarbuiten nog steeds wel.
- **nl-bron-niet-in-lijst, alinea:** de code weigerde de alinea, omdat die een bron noemde die de docent wel noemde maar niet in de lijst had. De prompt (`portfolio-draft@v2`, nog niet uitgebracht) zegt nu uitdrukkelijk: geen andere auteur, ook niet als de docent hem noemt, en ook niet zonder jaartal. Nameting: rapport `b`.
