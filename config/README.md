# Configuratie

## `models.json`: aanbieders, modellen en hun instellingen

Hier staat welke AI-aanbieders en -modellen LimeOnIt kent. Een aanbieder of model toevoegen,
een nieuwe versie zetten of instellingen aanpassen doe je hier, niet in de code. Na een
wijziging: `npm run dev` opnieuw starten, of opnieuw bouwen (`npm run build`, het Docker-image).
Een fout in het bestand stopt de app bij het opstarten, met een melding die zegt wat er mis is.

Modellen en aanbieders toevoegen, upgraden en uitfaseren kan ook zonder dit bestand, in het
beheerscherm **Tools en modellen**. Dat werkt meteen, zonder herstart. Een aanbieder uit het scherm
krijgt een sleutelinstelling op basis van zijn naam (`DeepSeek` → `DEEPSEEK_API_KEY`); die zet je
in `.env`. Een eigen server op het schoolnetwerk mag `http://` gebruiken en hoeft geen sleutel.

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
| `cache` | Hoe de aanbieder een prompt cachet die terugkomt (de volgende beurt van een chat): `"markers"` (wij markeren wat bewaard wordt; alleen de API van Anthropic), `"auto"` (de aanbieder doet het zelf) of `{ "key": "<veld>" }` (een vaste sleutel per docent en tool in dat veld, bijvoorbeeld `prompt_cache_key` of `session_id`). |

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
| `price` | De lijstprijs per miljoen tokens, zie hieronder. Mag weg (dan telt het model als "zonder prijs"). |

### `settings`: hoe een model antwoordt

| Veld | Betekenis |
| --- | --- |
| `effort` | Hoe hard het model nadenkt: `none`, `low`, `medium`, `high`, `xhigh` of `max`. Hoger is grondiger, trager en duurder. Niet elke aanbieder kent elk niveau. |
| `temperature` | 0 tot 2: laag is voorspelbaar, hoog creatiever. `null` = nooit meesturen (denkende modellen zoals GPT-6 weigeren een temperatuur). Weg = 0,4. |
| `maxTokens` | Hoe lang een antwoord maximaal mag zijn, als een tool zelf niets zegt. |

De model-id's zijn op 2026-11-06 nagekeken bij de aanbieders zelf.

### `speechToText`: dicteren

Welke server gesproken tekst uitschrijft als een docent op de microfoonknop drukt (in de
chat en in elk tekstvak van een formulier). Het is een `provider` met `api:
"openai-compatible"` en een `model`; LimeOnIt stuurt de opname (WAV) naar
`<adres>/audio/transcriptions`, de vorm van OpenAI die Whisper-servers ook spreken. Er wordt
niets bewaard. De browser praat nooit zelf met de server, en nooit met de spraakdienst van
Chrome (die stuurt audio naar Google).

Standaard staat hier de aanbieder `whisper`, met zijn adres in `.env` onder
`WHISPER_BASE_URL`. **Zonder adres is er geen microfoonknop.** Kies één van drie:

| Waar | `.env` |
| --- | --- |
| De Whisper-dienst in Docker (`docker compose --profile speech up -d`) | `WHISPER_BASE_URL=http://whisper:8178/v1` |
| whisper.cpp op deze computer | `WHISPER_BASE_URL=http://127.0.0.1:8178/v1` |
| OpenAI in de cloud (audio gaat de school uit: eerst AVG nakijken) | `WHISPER_BASE_URL=https://api.openai.com/v1` en `WHISPER_API_KEY=…` |

whisper.cpp op een Mac (gebruikt de GPU via Metal, snel):

```sh
brew install whisper-cpp
# model van ~550 MB, eenmalig:
curl -L -o ggml-large-v3-turbo-q5_0.bin \
  https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin
whisper-server --host 127.0.0.1 --port 8178 -m ggml-large-v3-turbo-q5_0.bin \
  --inference-path /v1/audio/transcriptions --suppress-nst --no-timestamps
```

Een eigen Whisper-server van de school: zet zijn adres in `WHISPER_BASE_URL` (een server op het
schoolnetwerk mag `http://`), en eventueel een sleutel in `WHISPER_API_KEY`.

### `price`: wat een model kost

De lijstprijs zoals de aanbieder hem publiceert, per miljoen tokens. Het dashboard *Gebruik*
rekent er de kosten mee uit. Een beheerder kan in **Tools en modellen** een eigen prijs zetten
(bijvoorbeeld bij een schoolcontract); die gaat voor. Bijwerken doe je met de skill
`/model-prices`, voor elke release.

| Veld | Betekenis |
| --- | --- |
| `currency` | `USD` of `EUR`, zoals op de prijspagina. |
| `input` | Invoer die niet uit de cache komt. |
| `output` | Uitvoer, inclusief het nadenken van het model. |
| `cacheRead` | Invoer die uit de cache komt. Weg = gelijk aan `input`. |
| `cacheWrite` | Invoer die in de cache wordt gezet, als de aanbieder daar apart voor rekent. Weg = gelijk aan `input`. |
| `checked` | De dag waarop de prijs is opgezocht (`2026-11-11`). |
| `source` | De prijspagina van de aanbieder. |

### `exchangeRate`: dollars naar euro's

Nodig zodra een model een prijs in `USD` heeft: `usdToEur` (bijvoorbeeld `0,86` als `0.86`),
met `checked` en `source` (de referentiekoers van de ECB).
