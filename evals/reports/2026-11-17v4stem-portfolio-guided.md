# Eval geleid schrijven — 2026-11-17

Prompts: portfolio-questions@v2 (vragen) en portfolio-draft@v4 (alinea), met tweede poging bij algemene wendingen. Model: claude-code::claude-sonnet-5-5. Herhalingen per case: 3. Deterministische score, en een beoordelaarsmodel voor de stem.

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
| nl-anker-les#1 | ja | ja | ja | ja | ja | ja | ja |
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
| nl-beginsituatie#2 | ja | 205 | ja | 100% | ja | ja | ja | ja | ja |
| nl-beginsituatie#3 | ja | 190 | ja | 100% | ja | ja | ja | ja | ja |
| nl-evaluatie-gaten#1 | ja | 92 | ja | 100% | ja | ja | ja | ja | ja |
| nl-evaluatie-gaten#2 | ja | 157 | ja | 100% | ja | ja | ja | ja | ja |
| nl-evaluatie-gaten#3 | ja | 124 | ja | 100% | ja | ja | ja | ja | ja |
| nl-criterium-zonder-opzet#1 | ja | 136 | ja | 100% | ja | ja | ja | ja | ja |
| nl-criterium-zonder-opzet#2 | ja | 113 | ja | 100% | ja | ja | ja | ja | ja |
| nl-criterium-zonder-opzet#3 | ja | 114 | ja | 100% | ja | ja | ja | ja | ja |
| nl-instructie-in-bewijs#1 | ja | 165 | ja | 100% | ja | ja | ja | ja | ja |
| nl-instructie-in-bewijs#2 | ja | 127 | ja | 100% | ja | ja | ja | ja | ja |
| nl-instructie-in-bewijs#3 | ja | 131 | ja | 100% | ja | ja | ja | ja | ja |
| nl-bron-niet-in-lijst#1 | ja | 125 | ja | 100% | ja | ja | ja | ja | ja |
| nl-bron-niet-in-lijst#2 | ja | 124 | ja | 100% | ja | ja | ja | ja | ja |
| nl-bron-niet-in-lijst#3 | ja | 127 | ja | 100% | ja | ja | ja | ja | ja |
| en-objectives#1 | ja | 155 | ja | 100% | ja | ja | ja | ja | ja |
| en-objectives#2 | ja | 148 | ja | 100% | ja | ja | ja | ja | ja |
| en-objectives#3 | ja | 152 | ja | 100% | ja | ja | ja | ja | ja |
| nl-anker-les#1 | ja | 159 | ja | 100% | ja | ja | ja | ja | ja |
| nl-anker-les#2 | ja | 160 | ja | 100% | ja | ja | ja | ja | ja |
| nl-anker-les#3 | ja | 163 | ja | 100% | ja | ja | ja | ja | ja |
| en-anchor-test#1 | ja | 185 | ja | 100% | ja | ja | ja | ja | ja |
| en-anchor-test#2 | ja | 207 | ja | 100% | ja | ja | ja | ja | ja |
| en-anchor-test#3 | ja | 193 | ja | 100% | ja | ja | ja | ja | ja |
| nl-gedicteerd#1 | ja | 192 | ja | 100% | ja | ja | ja | ja | ja |
| nl-gedicteerd#2 | ja | 220 | ja | 100% | ja | ja | ja | ja | ja |
| nl-gedicteerd#3 | ja | 195 | ja | 100% | ja | ja | ja | ja | ja |

## Stem (beoordelaar)

Beoordelaar: claude-code::claude-sonnet-5-5, blind voor de promptversie. Drie scores van 1 tot 5 per alinea (rubric.md, "Voice judge"). Overname: het deel van de woordreeksen van drie in de alinea dat letterlijk in de antwoorden van de docent staat (geteld, niet beoordeeld).

| Case | Eigen woorden | Alleen uit het materiaal | Ik-vorm zonder opvulling | Overname | Zwakste zin |
|---|---|---|---|---|---|
| nl-beginsituatie#1 | 4 | 4 | 3 | 22% | Zo kregen zij de basis onder handen voordat we met de opgaven over medicijnrekenen aan de slag gingen. |
| nl-beginsituatie#2 | 4 | 2 | 3 | 18% | Zo kregen zij de ruimte om de basis te herhalen, zonder dat de rest van de les stilviel. |
| nl-beginsituatie#3 | 4 | 3 | 4 | 19% | Over andere voorkennis, zoals rekenen met verhoudingen of eenheden, heb ik geen gegevens uit de toets gehaald. |
| nl-evaluatie-gaten#1 | 4 | 2 | 3 | 35% | Dat was de reactie die ik zelf zag tijdens de les. |
| nl-evaluatie-gaten#2 | 4 | 3 | 2 | 7% | Het effect van de les zie ik nu vooral in de betrokkenheid bij de casus. |
| nl-evaluatie-gaten#3 | 5 | 4 | 4 | 12% | Voor een volgende les neem ik het volgende mee. |
| nl-criterium-zonder-opzet#1 | 4 | 5 | 4 | – | De werkplekbegeleider observeerde de les en noteerde dat alle tweetallen aan het woord kwamen. |
| nl-criterium-zonder-opzet#2 | 4 | 3 | 3 | – | Zo had elke student iets te zeggen over het onderwerp voordat ik zelf iets uitlegde. |
| nl-criterium-zonder-opzet#3 | 4 | 3 | 3 | – | Alle tweetallen kwamen daarbij aan het woord, dus niet alleen de studenten die vanzelf hun hand opsteken. |
| nl-instructie-in-bewijs#1 | 4 | 3 | 3 | 12% | Het doel beschrijft daarom iets wat een student zichtbaar kan doen, en niet iets wat alleen te benoemen is. |
| nl-instructie-in-bewijs#2 | 4 | 3 | 3 | 16% | Omdat het doel een zichtbare handeling beschrijft, kon ik per student vaststellen of de overdracht er daadwerkelijk was. |
| nl-instructie-in-bewijs#3 | 4 | 3 | 4 | 16% | Zo zag ik van iedere student afzonderlijk of de overdracht er stond, en niet alleen van de groep als geheel. |
| nl-bron-niet-in-lijst#1 | 4 | 4 | 3 | 30% | Dat model zie je terug in de opbouw: ik begon met het activeren van voorkennis en sloot af met een terugblik op het lesdoel. |
| nl-bron-niet-in-lijst#2 | 4 | 5 | 5 | 35% | Mijn aanpak van feedback onderbouw ik met [aanvullen: bron in je literatuurlijst]. |
| nl-bron-niet-in-lijst#3 | 4 | 3 | 3 | 16% | Dat model heeft me houvast gegeven voor de opbouw van de les. |
| en-objectives#1 | 4 | 2 | 4 | 6% | That made it possible to check the objective with an exit ticket at the end of the lesson, instead of having to guess from the atmosphere in the room whether students had understood it. |
| en-objectives#2 | 3 | 3 | 4 | 9% | That meant I could check it directly with an exit ticket, without having to infer understanding from how the students seemed during the lesson. |
| en-objectives#3 | 4 | 2 | 4 | 6% | That made it possible to test the objective directly with an exit ticket at the end of the lesson, instead of having to guess from the atmosphere in the room whether they had understood it. |
| nl-anker-les#1 | 4 | 3 | 4 | 16% | Ik begon met een herhaling van breuken, zodat alle studenten dezelfde basis hadden voordat we aan de doseerberekeningen begonnen. |
| nl-anker-les#2 | 4 | 3 | 4 | 12% | Ik begon de les met een herhaling van breuken, omdat breuken de basis zijn voor het doelberekenen zonder rekenmachine. |
| nl-anker-les#3 | 4 | 3 | 4 | 17% | Ik begon daarom met een herhaling van breuken voor de hele groep. Daarna liet ik de 9 studenten die breuken lastig vonden eerst in tweetallen oefenen, zodat zij de basis onder de dosisberekening op orde kregen voordat ze zelf doseringen gingen uitrekenen. |
| en-anchor-test#1 | 4 | 3 | 4 | 12% | Because it is a written exam, I see each student do this on their own, and I can be sure that the design I assess is the student's own work. |
| en-anchor-test#2 | 4 | 3 | 4 | 12% | Because the work is individual, the result shows what that student can do, and not what a project group managed to do together. |
| en-anchor-test#3 | 4 | 3 | 4 | 11% | Students cannot lean on a group, and I see for every individual how they arrive at a normalised model. |
| nl-gedicteerd#1 | 4 | 3 | 3 | 35% | Het uitlopen is de prijs die ik daarvoor betaalde. |
| nl-gedicteerd#2 | 4 | 2 | 3 | 30% | De extra uitleg kostte tijd en die heb ik in de rest van de kern niet terugverdiend. |
| nl-gedicteerd#3 | 4 | 2 | 3 | 32% | De extra uitleg kostte tijd die ik niet had ingepland. |

Gemiddeld over 27 beoordeelde alinea's: eigen woorden 4,0, alleen uit het materiaal 3,0, ik-vorm zonder opvulling 3,5, overname 18%.

Geslaagd: 27 van 27.
