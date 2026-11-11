---
name: model-prices
description: Keep the AI model prices in config/models.json current for the usage and cost dashboard. Use before a release, or when someone asks to update prices, the exchange rate or the model list ("update prices", "model prices", "are the costs still right").
---

# Update model prices

The dashboard computes costs from each model's **list price** in `config/models.json`
(`models[].price`), converted to euros with `exchangeRate`. An admin can set an own price on
screen; that one wins. This skill keeps the list prices and the rate current, so nobody has to
track them by hand.

## Rules

- **Only the provider's own pricing page counts as a source.** No blogs, no comparison sites,
  no memory. Open the page itself; a search snippet is not a source.
- **Every price has `checked` (today) and `source` (the page).** A price you cannot find stays
  as it is, and you report it. Never guess.
- **Standard rate.** Take the regular API rate: no batch or off-peak discount, and no price for
  prompts above a length threshold (do mention the threshold in the PR). If a provider offers
  several cache durations, take the default one (Anthropic: 5 minutes). An introductory price
  counts while it applies; note its end date in the PR.
- **Fields** (per million tokens, in the page's currency): `input`, `output`, `cacheRead` (a
  cache hit), `cacheWrite` (writing to the cache; only when the provider charges for it
  separately). `currency` is `USD` or `EUR`.
- **Resellers** (`openrouter`, `opencode-zen`, `together`): the price of that model on their own
  page. `openrouter/auto` has no fixed price: no `price`, and say so in the PR.
- **Local models and CLI agents** never get a price; they count as free.
- **Exchange rate:** `exchangeRate.usdToEur` = 1 divided by the ECB euro reference rate (USD per
  EUR) of the last working day. Source:
  `https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/eurofxref-graph-usd.en.html`.
  Round to 4 decimals.

## Steps

1. Read `config/models.json` and `config/README.md` (the fields).
2. Per provider (`providers[].modelsUrl` points at the models; the pricing page is usually next
   to it), update the price of every model with that `provider`. Note per model: old price, new
   price, source.
3. Check whether the provider has a **new model** that succeeds one in the catalog, or is
   **retiring** one. Do not change the model list yourself: name it in the PR, Bastiaan decides
   (an upgrade goes through the admin screen or a separate PR).
4. Update `exchangeRate`.
5. Run the gate: `npm test && npm run typecheck && npm run check`. The boot check
   (`parseModelsConfig`) refuses a price without `checked` or `source`, and a dollar price
   without a rate.
6. One branch from `main`, one PR, following `.github/pull_request_template.md` (in Dutch, like
   all PRs here). Open with what gets more or less expensive, in plain language. Below it, a table:
   model, old, new (in the page's currency), change in percent, source. Then the new and retiring
   models.
7. Nothing changed? Make no PR and say so in one sentence.

## What this does not do

It does not change an admin's own prices (they live in the database) or costs already counted:
a price is a snapshot taken when a call is counted.
