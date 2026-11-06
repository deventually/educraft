# Configuratie

## `models.json`: aanbieders, modellen en hun instellingen

Hier staat welke AI-aanbieders en -modellen LimeOnIt kent. Een aanbieder of model toevoegen,
een nieuwe versie zetten of instellingen aanpassen doe je hier, niet in de code. Na een
wijziging: `npm run dev` opnieuw starten, of opnieuw bouwen (`npm run build`, het Docker-image).
Een fout in het bestand stopt de app bij het opstarten, met een melding die zegt wat er mis is.

Modellen toevoegen, upgraden en uitfaseren kan ook zonder dit bestand, in het beheerscherm
**Tools en modellen**. Dat werkt meteen, zonder herstart.

De **sleutels** staan nooit hier, maar in `.env` op de server (BESLUIT-2026-11-06-1). Dit bestand
noemt alleen de naam van de instelling (`keyEnv`).

### `default`

Het model dat tools gebruiken als niets anders gekozen is. Moet in `models` staan.

### `providers`: de aanbieders

| Veld | Betekenis |
| --- | --- |
| `id` | Korte naam, kleine letters, bijvoorbeeld `openrouter`. |
| `name` | De naam in het beheerscherm (tekst, of `{ "nl": …, "en": … }`). |
| `api` | `anthropic` (de API van Anthropic) of `openai-compatible` (de chat-API van OpenAI, die bijna elke aanbieder ook spreekt). |
| `baseURL` | Het adres van de API, bijvoorbeeld `https://openrouter.ai/api/v1`. |
| `keyEnv` | De naam van de sleutel in `.env`, eindigend op `_API_KEY`. |
| `keyOptional` | `true` als er geen sleutel nodig is (een eigen server). |
| `baseURLEnv` | Alleen voor een adres dat per server verschilt: de naam van de instelling in `.env`. |
| `modelsUrl` | Link naar de lijst met modellen van de aanbieder (voor het beheerscherm). |
| `example` | Een voorbeeld-model-id, als hulp in het formulier. |

Ingebouwd en dus niet in `providers`: de lokale servers `ollama` en `lmstudio` en de CLI-agents
`claude-code`, `opencode`, `codex` en `gemini-cli`. Die werken alleen buiten productie.

### `models`: de modellen

| Veld | Betekenis |
| --- | --- |
| `id` | Vaste naam in LimeOnIt. Verander die niet als er al resultaten mee gemaakt zijn. |
| `provider` | Een `id` uit `providers`, of een ingebouwde lokale. |
| `apiId` | De naam van het model bij de aanbieder, bijvoorbeeld `claude-haiku-5-5`. |
| `displayName` | De naam die gebruikers zien. |
| `supportsImages` | Kan het model foto's lezen? |
| `alwaysThinks` | Denkt het model altijd eerst na (Claude 5)? Dan krijgt het extra ruimte. |
| `tier` | 1 = licht en goedkoop, 2 = middel, 3 = zwaar en duur. Alleen voor de volgorde. |
| `local` | Draait op de eigen computer (alleen buiten productie). |
| `clientSelectable` | Mogen docenten het zelf kiezen? `false` voor dure modellen. |
| `settings` | Hoe het model antwoordt, zie hieronder. Mag weg. |

### `settings`: hoe een model antwoordt

| Veld | Betekenis |
| --- | --- |
| `effort` | Hoe hard het model nadenkt: `none`, `low`, `medium`, `high`, `xhigh` of `max`. Hoger is grondiger, trager en duurder. Niet elke aanbieder kent elk niveau. |
| `temperature` | 0 tot 2: laag is voorspelbaar, hoog creatiever. `null` = nooit meesturen (denkende modellen zoals GPT-6 weigeren een temperatuur). Weg = 0,4. |
| `maxTokens` | Hoe lang een antwoord maximaal mag zijn, als een tool zelf niets zegt. |

De model-id's zijn op 2026-11-06 nagekeken bij de aanbieders zelf.
