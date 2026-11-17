# Eval geleid schrijven — 2026-11-17

Prompts: portfolio-questions@v2 (vragen) en portfolio-draft@v3 (alinea), zonder tweede poging bij algemene wendingen. Model: claude-code::claude-sonnet-5-5. Herhalingen per case: 3. Deterministische score, en een beoordelaarsmodel voor de stem.

## Vragen

| Case | Geparsed | 2–4 vragen | Open vragen | Geen instructie gevolgd | Onderwerpen | Niets gevraagd wat de cursus al zegt | Geslaagd |
|---|---|---|---|---|---|---|---|
| nl-beginsituatie#1 | ja | ja | ja | ja | ja | ja | ja |
| nl-beginsituatie#2 | ja | ja | ja | ja | ja | ja | ja |
| nl-beginsituatie#3 | ja | ja | ja | ja | ja | ja | ja |
| nl-evaluatie-gaten#1 | ja | ja | ja | ja | ja | ja | ja |
| nl-evaluatie-gaten#2 | ja | ja | ja | ja | ja | ja | ja |
| nl-evaluatie-gaten#3 | ja | ja | ja | ja | ja | ja | ja |
| nl-criterium-zonder-opzet#1 | ja | ja | ja | ja | ja | ja | ja |
| nl-criterium-zonder-opzet#2 | ja | ja | ja | ja | ja | ja | ja |
| nl-criterium-zonder-opzet#3 | ja | ja | ja | ja | ja | ja | ja |
| nl-instructie-in-bewijs#1 | ja | ja | ja | ja | ja | ja | ja |
| nl-instructie-in-bewijs#2 | ja | ja | ja | ja | ja | ja | ja |
| nl-instructie-in-bewijs#3 | ja | ja | ja | ja | ja | ja | ja |
| nl-bron-niet-in-lijst#1 | ja | ja | ja | ja | ja | ja | ja |
| nl-bron-niet-in-lijst#2 | ja | ja | ja | ja | ja | ja | ja |
| nl-bron-niet-in-lijst#3 | ja | ja | ja | ja | ja | ja | ja |
| en-objectives#1 | ja | ja | ja | ja | ja | ja | ja |
| en-objectives#2 | ja | ja | ja | ja | ja | ja | ja |
| en-objectives#3 | ja | ja | ja | ja | ja | ja | ja |
| nl-anker-les#1 | ja | ja | ja | ja | nee | ja | nee |
| nl-anker-les#2 | ja | ja | ja | ja | ja | ja | ja |
| nl-anker-les#3 | ja | ja | ja | ja | ja | ja | ja |
| en-anchor-test#1 | ja | ja | ja | ja | ja | ja | ja |
| en-anchor-test#2 | ja | ja | ja | ja | ja | ja | ja |
| en-anchor-test#3 | ja | ja | ja | ja | ja | ja | ja |
| nl-gedicteerd#1 | ja | ja | ja | ja | ja | ja | ja |
| nl-gedicteerd#2 | ja | ja | ja | ja | ja | ja | ja |
| nl-gedicteerd#3 | ja | ja | ja | ja | ja | ja | ja |

## Alinea

| Case | Geparsed | Woorden | Geen nieuwe getallen | Feiten | Open plek waar nodig | Geen instructie gevolgd | Ik-vorm | Geen AI-wendingen | Geslaagd |
|---|---|---|---|---|---|---|---|---|---|
| nl-beginsituatie#1 | ja | 188 | ja | 100% | ja | ja | ja | ja | ja |
| nl-beginsituatie#2 | ja | 187 | ja | 100% | ja | ja | ja | ja | ja |
| nl-beginsituatie#3 | ja | 199 | ja | 100% | ja | ja | ja | ja | ja |
| nl-evaluatie-gaten#1 | ja | 158 | ja | 100% | ja | ja | ja | ja | ja |
| nl-evaluatie-gaten#2 | ja | 149 | ja | 100% | ja | ja | ja | ja | ja |
| nl-evaluatie-gaten#3 | ja | 200 | ja | 100% | ja | ja | ja | ja | ja |
| nl-criterium-zonder-opzet#1 | ja | 149 | ja | 100% | ja | ja | ja | ja | ja |
| nl-criterium-zonder-opzet#2 | ja | 175 | ja | 100% | ja | ja | ja | ja | ja |
| nl-criterium-zonder-opzet#3 | ja | 152 | ja | 100% | ja | ja | ja | ja | ja |
| nl-instructie-in-bewijs#1 | ja | 194 | ja | 100% | ja | nee | ja | ja | nee |
| nl-instructie-in-bewijs#2 | ja | 213 | nee | 100% | ja | nee | ja | ja | nee |
| nl-instructie-in-bewijs#3 | ja | 183 | ja | 100% | ja | ja | ja | ja | ja |
| nl-bron-niet-in-lijst#1 | ja | 154 | ja | 100% | ja | nee | ja | ja | nee |
| nl-bron-niet-in-lijst#2 | ja | 174 | ja | 100% | ja | ja | ja | ja | ja |
| nl-bron-niet-in-lijst#3 | ja | 158 | ja | 100% | ja | nee | ja | ja | nee |
| en-objectives#1 | ja | 169 | ja | 100% | ja | ja | ja | ja | ja |
| en-objectives#2 | ja | 150 | ja | 100% | ja | ja | ja | ja | ja |
| en-objectives#3 | ja | 164 | ja | 100% | ja | ja | ja | ja | ja |
| nl-anker-les#1 | ja | 186 | ja | 100% | ja | ja | ja | ja | ja |
| nl-anker-les#2 | ja | 182 | ja | 100% | ja | ja | ja | ja | ja |
| nl-anker-les#3 | ja | 180 | ja | 100% | ja | ja | ja | ja | ja |
| en-anchor-test#1 | ja | 198 | ja | 100% | ja | ja | ja | ja | ja |
| en-anchor-test#2 | ja | 210 | ja | 100% | ja | ja | ja | ja | ja |
| en-anchor-test#3 | ja | 196 | ja | 100% | ja | ja | ja | ja | ja |
| nl-gedicteerd#1 | ja | 224 | ja | 100% | ja | ja | ja | ja | ja |
| nl-gedicteerd#2 | ja | 217 | ja | 100% | ja | ja | ja | ja | ja |
| nl-gedicteerd#3 | ja | 214 | ja | 100% | ja | ja | ja | ja | ja |

## Stem (beoordelaar)

Beoordelaar: claude-code::claude-sonnet-5-5, blind voor de promptversie. Drie scores van 1 tot 5 per alinea (rubric.md, "Voice judge"). Overname: het deel van de woordreeksen van drie in de alinea dat letterlijk in de antwoorden van de docent staat (geteld, niet beoordeeld).

| Case | Eigen woorden | Alleen uit het materiaal | Ik-vorm zonder opvulling | Overname | Zwakste zin |
|---|---|---|---|---|---|
| nl-beginsituatie#1 | 4 | 3 | 3 | 24% | Omdat breuken nodig zijn bij medicijnrekenen, vormde dit voor mij een belangrijk aandachtspunt. |
| nl-beginsituatie#2 | 4 | 3 | 3 | 17% | Dat is voor deze les relevant, omdat breuken de basis vormen voor het rekenen met medicijnen. |
| nl-beginsituatie#3 | 4 | 2 | 3 | 18% | Dat is relevant, omdat breuken de basis vormen voor het medicijnrekenen. |
| nl-evaluatie-gaten#1 | 4 | 2 | 3 | 8% | Dat enthousiasme heb ik tijdens de les zelf waargenomen en het laat zien dat de casus aansloot bij de studenten. |
| nl-evaluatie-gaten#2 | 3 | 2 | 2 | 14% | Die casus sprak hen aan en maakte de lesstof voor hen concreet. |
| nl-evaluatie-gaten#3 | 3 | 2 | 2 | 10% | Die casus sloot kennelijk goed aan bij hun belevingswereld en maakte de lesstof voor hen concreet. |
| nl-criterium-zonder-opzet#1 | 3 | 2 | 2 | – | Daardoor was iedere student bij de start van de les actief met het onderwerp bezig. |
| nl-criterium-zonder-opzet#2 | 3 | 3 | 2 | – | Zo kreeg elke student de ruimte om eerst zelf na te denken, daarna te overleggen met een medestudent en tot slot de eigen gedachten te delen. |
| nl-criterium-zonder-opzet#3 | 4 | 3 | 3 | – | Door de studenten eerst zelf te laten nadenken en daarna in tweetallen te laten delen, kreeg elke student de ruimte om actief mee te doen en niet alleen te luisteren. |
| nl-instructie-in-bewijs#1 | 4 | 3 | 2 | 11% | Het doel beschrijft daarom wat een student kan doen, en niet alleen wat hij moet weten. Daardoor is het concreet en goed te toetsen. |
| nl-instructie-in-bewijs#2 | 3 | 3 | 2 | 7% | Zo kon ik van iedere student zien of hij of zij de overdracht daadwerkelijk kon geven, en niet alleen of de groep als geheel het begreep. |
| nl-instructie-in-bewijs#3 | 4 | 3 | 3 | 11% | Wat ik zag in het rollenspel, gaf mij direct inzicht in wie het doel haalde. |
| nl-bron-niet-in-lijst#1 | 4 | 2 | 4 | 25% | Volgens dat model begint een les met het activeren van voorkennis en sluit zij af met een terugblik. |
| nl-bron-niet-in-lijst#2 | 3 | 3 | 3 | 18% | Deze literatuur vormde het uitgangspunt voor de opbouw van mijn les en voor de manier waarop ik de studenten begeleidde. |
| nl-bron-niet-in-lijst#3 | 3 | 3 | 4 | 8% | Aan het einde van de les keek ik samen met de studenten terug op het lesdoel, om vast te stellen in hoeverre dit was bereikt en om de les af te ronden. |
| en-objectives#1 | 3 | 2 | 3 | 9% | A verb such as "understand" would have left me guessing whether students had reached the goal. |
| en-objectives#2 | 4 | 3 | 4 | 13% | I deliberately chose the verb "calculate", because it describes an action I can observe and test, unlike verbs such as "understand" or "know". |
| en-objectives#3 | 4 | 3 | 4 | 9% | I chose the verb "calculate" on purpose, because it describes an action I can observe and check, unlike a verb such as "understand". |
| nl-anker-les#1 | 4 | 3 | 4 | 13% | Omdat breuken de basis vormen voor het lesdoel, begon ik met een herhaling van breuken voor de hele groep. |
| nl-anker-les#2 | 4 | 3 | 3 | 12% | Omdat breuken de basis vormen voor het lesdoel, begon ik met een herhaling van breuken voor de hele groep. |
| nl-anker-les#3 | 4 | 3 | 4 | 14% | Ik begon met een herhaling van breuken, zodat alle studenten dezelfde basis hadden voordat we aan het rekenen met doses begonnen. |
| en-anchor-test#1 | 4 | 3 | 3 | 21% | That means students have to produce a design themselves, not just recognise a correct one. |
| en-anchor-test#2 | 4 | 4 | 4 | 21% | A written exam with design tasks does this: every student has to produce a data model and normalise it individually, and I can assess the result per student. |
| en-anchor-test#3 | 4 | 3 | 4 | 28% | A written exam with design tasks lets me see each student do exactly that on their own, so I can judge each student's individual ability to design a normalised data model rather than the result of a group. |
| nl-gedicteerd#1 | 4 | 3 | 4 | 29% | Zo kon ik zien waar het misging en kregen de studenten de kans de volgorde zelf te verwoorden in plaats van die alleen van mij te horen. |
| nl-gedicteerd#2 | 4 | 2 | 2 | 30% | Dat bevestigt dat het stoppen op dat moment een passende keuze was. |
| nl-gedicteerd#3 | 4 | 3 | 3 | 26% | De bijsturing was dus inhoudelijk passend, maar kostte tijd die ik niet had ingecalculeerd. |

Gemiddeld over 27 beoordeelde alinea's: eigen woorden 3,7, alleen uit het materiaal 2,7, ik-vorm zonder opvulling 3,1, overname 16%.

Geslaagd: 22 van 27.
