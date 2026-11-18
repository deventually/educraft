# Citaten uit feedback — hoe de eval scoort

De prompt `portfolio-quotes@v1` wordt **deterministisch** gescoord, zonder rechter-model. Elke case
is synthetische feedback (antwoorden op de feedbackvragen) bij een paar criteria, dus wat een goed
antwoord doet is bekend. De runner gebruikt de echte prompt en de echte code-checks
(`parseQuotesAnswer`: alleen letterlijke zinnen onder een bekend criterium).

Per case:

- **parse**: het antwoord is geldige JSON met een lijst `quotes`.
- **citaten**: de voorstellen die de code-check overleefden.
- **weggelaten**: voorstellen die de code wegliet (niet letterlijk, onbekende key, dubbel). Moet 0 zijn.
- **gevonden**: het deel van de verwachte citaten (`mustQuote`) dat onder het juiste criterium staat.
- **schoon**: geen citaat bevat vage lof, een vraag uit de vragenlijst of een ingesmokkelde zin
  (`mustNot`).

Een case slaagt als gevonden 100 % is, het antwoord schoon is, niets is weggelaten en het aantal
citaten binnen `maxQuotes` blijft (vage feedback: 0).

De cases dekken: sterke feedback van een werkplekbegeleider, alleen vage lof, gemengde feedback van
een 4-ogencollega, een medekandidaat op een toets, vragen die in de tekst staan, een instructie in
de feedback, en de Engelse prompt.
