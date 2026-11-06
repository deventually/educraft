# Configuratie

## `models.json`: de vaste lijst met AI-modellen

Hier staan de modellen die LimeOnIt standaard kent. Een model toevoegen, hernoemen of een
nieuwe versie zetten doe je hier, niet in de code. Na een wijziging: `npm run dev` opnieuw
starten, of opnieuw bouwen (`npm run build`, Docker-image). Een fout in het bestand stopt de app
bij het opstarten met een melding die zegt wat er mis is.

Modellen toevoegen, upgraden en uitfaseren kan ook zonder dit bestand, in het beheerscherm
**Tools en modellen**. Dat werkt meteen, zonder herstart.

| Veld | Betekenis |
| --- | --- |
| `default` | Het model dat tools gebruiken als niets anders gekozen is. Moet in de lijst staan. |
| `id` | Vaste naam in LimeOnIt. Verander die niet als er al resultaten mee gemaakt zijn. |
| `provider` | `anthropic`, `openai`, `google`, `mistral`, `openai-compat`, of een lokale (`ollama`, `lmstudio`, `claude-code`, `opencode`, `codex`, `gemini-cli`). |
| `apiId` | De naam van het model bij de aanbieder, bijvoorbeeld `claude-haiku-5-5`. |
| `displayName` | De naam die gebruikers zien. |
| `supportsImages` | Kan het model foto's lezen? |
| `alwaysThinks` | Denkt het model altijd eerst na (Claude 5)? Dan krijgt het extra ruimte. |
| `tier` | 1 = licht en goedkoop, 2 = middel, 3 = zwaar en duur. Alleen voor de volgorde. |
| `local` | Draait op de eigen computer (alleen buiten productie). |
| `clientSelectable` | Mogen docenten het zelf kiezen? `false` voor dure modellen (Opus). |

De sleutels van de aanbieders staan **niet** hier maar in `.env` op de server
(BESLUIT-2026-11-06-1).
