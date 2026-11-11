---
name: modelprijzen
description: Houd de prijzen van AI-modellen in config/models.json actueel voor het dashboard Gebruik en kosten. Gebruik voor een release, of als iemand vraagt om prijzen, de wisselkoers of de modellijst bij te werken ("prijzen bijwerken", "modelprijzen", "kloppen de kosten nog").
---

# Modelprijzen bijwerken

Het dashboard rekent kosten uit met de **lijstprijs** van elk model in `config/models.json`
(`models[].price`), omgerekend naar euro met `exchangeRate`. Een beheerder kan op het scherm
een eigen prijs zetten; die wint. Deze skill houdt de lijstprijzen en de koers actueel, zodat
niemand het met de hand hoeft bij te houden.

## Regels

- **Alleen de eigen prijspagina van de aanbieder telt als bron.** Geen blog, geen vergelijksite
  en geen geheugen. Open de pagina zelf; een zoekresultaat is geen bron.
- **Elke prijs heeft `checked` (vandaag) en `source` (de pagina).** Een prijs die je niet kunt
  vinden, laat je staan zoals hij is, en je meldt het. Je raadt nooit.
- **Standaardtarief.** Neem het gewone tarief voor de API: geen batch- en geen
  nachtkorting, en geen prijs voor promptlengtes boven een drempel (noem die wel in de PR). Heeft een
  aanbieder meer cacheduren, neem dan de standaardduur (Anthropic: 5 minuten).
- **Velden** (per miljoen tokens, in de munt van de pagina): `input`, `output`, `cacheRead`
  (een cache-hit), `cacheWrite` (in de cache zetten; alleen als de aanbieder daar apart voor
  rekent). `currency` is `USD` of `EUR`.
- **Doorverkopers** (`openrouter`, `opencode-zen`, `together`): de prijs van dat model op hun
  eigen pagina. `openrouter/auto` heeft geen vaste prijs: geen `price`, en dat zeg je in de PR.
- **Lokale modellen en CLI-agents** krijgen nooit een prijs; ze tellen als gratis.
- **Wisselkoers:** `exchangeRate.usdToEur` = 1 gedeeld door de euro-referentiekoers van de ECB
  (USD per EUR) van de laatste werkdag. Bron:
  `https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/eurofxref-graph-usd.en.html`.
  Rond af op 4 decimalen.

## Stappen

1. Lees `config/models.json` en `config/README.md` (de velden).
2. Werk per aanbieder (`providers[].modelsUrl` wijst de modellen, de prijspagina staat meestal
   ernaast) de prijs bij van elk model met die `provider`. Noteer per model: oude prijs, nieuwe
   prijs, bron.
3. Kijk of de aanbieder een **nieuw model** heeft dat een model in de catalogus opvolgt, of een
   model **uitfaseert**. Verander de modellijst niet zelf: noem het in de PR, dan beslist
   Bastiaan (een upgrade gaat via het beheerscherm of een aparte PR).
4. Werk `exchangeRate` bij.
5. Draai test-first de poort: `npm test && npm run typecheck && npm run check`. De opstartcontrole
   (`parseModelsConfig`) weigert een prijs zonder `checked` of `source`, en een dollarprijs
   zonder koers.
6. Eén branch vanaf `main`, één PR, volgens `.github/pull_request_template.md`. Zet bovenaan in
   gewone taal wat er duurder of goedkoper wordt. Daaronder komt een tabel: model, oud, nieuw
   (in de munt van de pagina), verschil in procenten en bron. Daarna volgen de nieuwe en
   verdwenen modellen.
7. Is er niets veranderd? Maak dan geen PR en meld dat in één zin.

## Wat dit niet doet

Het verandert geen eigen prijzen van een beheerder (die staan in de database) en geen kosten die
al geteld zijn: een prijs is een momentopname bij het tellen van een aanroep.
