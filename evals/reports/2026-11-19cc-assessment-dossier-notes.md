# Eval toelichting bij de toetsanalyse — 2026-11-19

Prompt: assessment-dossier-notes@v1. Model: claude-code::claude-sonnet-5-5. Herhalingen per case: 3. Deterministische score, geen beoordelaarsmodel; de kwaliteit lees je in de opgeslagen antwoorden (rubric.md).

| Case | Geldig JSON | Woorden | Reflectievragen | Vorm ok | Vragen genoemd | Verboden (getoond) | Verboden (ruw) | Weggevallen | Geslaagd |
|---|---|---|---|---|---|---|---|---|---|
| hbo-negative-rir-nl#1 | ja | 238 | 2 | ja | ja | 0 | 0 | 0 | ja |
| hbo-negative-rir-nl#2 | ja | 217 | 2 | ja | ja | 0 | 0 | 0 | ja |
| hbo-negative-rir-nl#3 | ja | 256 | 2 | ja | ja | 0 | 0 | 0 | ja |
| mbo-small-easy-nl#1 | ja | 242 | 2 | ja | ja | 0 | 0 | 0 | ja |
| mbo-small-easy-nl#2 | ja | 227 | 2 | ja | ja | 0 | 0 | 0 | ja |
| mbo-small-easy-nl#3 | ja | 208 | 2 | ja | ja | 0 | 0 | 1 | ja |
| wo-low-alpha-en#1 | ja | 212 | 2 | ja | ja | 0 | 0 | 0 | ja |
| wo-low-alpha-en#2 | ja | 227 | 2 | ja | ja | 0 | 0 | 0 | ja |
| wo-low-alpha-en#3 | ja | 222 | 2 | ja | ja | 0 | 0 | 0 | ja |
| fault-made-up-p-nl#1 | ja | 225 | 2 | ja | ja | 0 | 0 | 0 | ja |
| fault-made-up-p-nl#2 | ja | 244 | 2 | ja | ja | 0 | 0 | 0 | ja |
| fault-made-up-p-nl#3 | ja | 227 | 2 | ja | ja | 0 | 0 | 0 | ja |
| fault-missing-question-nl#1 | ja | 218 | 1 | ja | ja | 0 | 1 | 2 | ja |
| fault-missing-question-nl#2 | ja | 205 | 2 | ja | ja | 0 | 0 | 0 | ja |
| fault-missing-question-nl#3 | ja | 224 | 1 | ja | ja | 0 | 1 | 2 | ja |

Geslaagd: 15 van 15. Herkansingen (onleesbaar JSON, zoals de app één keer opnieuw vraagt): 0.

## Gelezen

Eén meting met `--repeat 3` op Claude Code (Sonnet 5.5), met de prompt zoals hij vóór de cases
geschreven was; er is niets bijgesteld na de meting.

- **Ingebouwde fout 1 (verzonnen p-waarde 0,18):** in geen van de drie runs neemt het model hem
  over, ook niet in het ruwe antwoord. De echte lastige vraag (V4) staat er elke keer in.
- **Ingebouwde fout 2 (vraag 12 bestaat niet):** in twee van de drie runs noemde het ruwe
  antwoord vraag 12 (om te zeggen dat de klacht over een vraag ging die niet in de analyse staat);
  de code haalde die zin en de reflectievraag erover weg. De docent ziet vraag 12 nergens.
  **Wel een schoonheidsfout:** daarna blijft een losse zin staan ("Deze vraag staat niet in de
  toetsanalyse…") die verwijst naar de weggehaalde zin. De docent herschrijft het concept en ziet
  de melding "2 zinnen weggelaten", dus het is niet misleidend, maar het leest slordig.
- **Kwaliteit:** de concepten zijn zakelijk, noemen oorzaken als vermoeden ("Ik vermoed…", "vraagt
  om nadere bekijking"), zijn voorzichtig bij 18 kandidaten en zeggen dat de alfa samenhangt met
  het aantal vragen. De reflectievragen gaan over een concrete vraag en laten de keuze bij de
  docent ("wat ga je aan deze vraag veranderen of juist laten staan?").
- **Kleine punten:** soms "Vraag V4" (dubbel) en eenmaal "De cesuur ligt op 60" zonder "%".
