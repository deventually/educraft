# De LimeOnIt-fabriek

LimeOnIt wordt gebouwd door een kleine softwarefabriek, het lichte broertje van any1-studio:

```
 jij ──vraag──▶ 🍋 Producer (Claude-project, elke thread)
                    │  knipt op, kiest model, delegeert
                    ▼
                werkers (sessies/subagents) ── bouwen test-first ──▶ PR
                    ▲                                              │
                    └── review + CI groen + geen conflicten ◀──────┘
 jij ◀── "🍋 Klaar … Wat jij moet doen: keur goed <link>" ── Producer
 jij ── merge ──▶ main
```

- **Eén Producer**, de enige die met jou praat, in gewone taal. Hij bouwt nooit zelf.
- **Werkers** doen één stuk werk, eindigen in één PR, en volgen `AGENTS.md`.
- **Alleen jij merget.**

| Bestand | Wat |
| --- | --- |
| [`voorkeuren.md`](voorkeuren.md) | **Jouw bedieningspaneel:** taal, toon, autonomie, modellen, wat eerst gevraagd wordt. Wint van alles |
| [`producer.md`](producer.md) | De rol van de Producer |
| [`STATUS.md`](STATUS.md) | Het bord: verzoeken, wat op jou wacht, wat volgt, open vragen |
| [`bord/`](bord/) | Wat er gemerged is: één bestand per PR, zodat PR's niet botsen |
| [`besluiten.md`](besluiten.md) | Het besluitenlog: één regel per besluit, het nieuwste wint |
| [`lessen.md`](lessen.md) | Correcties en de lessen eruit |
| [`geschiedenis.md`](geschiedenis.md) | Tijdlijn mei–november 2026 en productlessen; achtergrond |
| [`projectinstructies.md`](projectinstructies.md) | Tekst voor de instructies van het Claude-project |
| [`startprompt.md`](startprompt.md) | Het eerste bericht in de eerste thread |

## Inrichten (eenmalig)

1. **GitHub:** bescherm `main`. Ga naar *Settings → Branches → Add branch ruleset*:
   - **Ruleset name:** `main`
   - **Enforcement status:** Active
   - **Target branches:** *Include default branch*
   - **Aan:**
     - *Restrict deletions*
     - *Require a pull request before merging*, met *Required approvals* op **0** (de werkers
       openen PR's onder jouw account, en je kunt je eigen PR niet goedkeuren; jouw merge-klik is
       de goedkeuring)
     - *Require status checks to pass*, met de check **`ci`**
     - *Block force pushes*
2. **Claude-project:**
   - Maak op claude.ai een project **LimeOnIt** aan.
   - Plak de tekst uit [`projectinstructies.md`](projectinstructies.md) bij **Instructies**.
   - Voeg bij **Projectkennis** via GitHub de repo `deventually/educraft` toe, en selecteer
     `docs/fabriek/`, `AGENTS.md`, `docs/VISION.md`, `docs/implementation/README.md` en `wiki/`.
3. **Start:** open een nieuwe thread en plak [`startprompt.md`](startprompt.md).
4. **Bijhouden:** klik na elke merge op **sync** bij de GitHub-kennis.

## Werkers buiten het project

Start je zelf een sessie in Claude Code (terminal of desktop-app), dan is dat een **werker**, geen
Producer. De werkersregels staan in `AGENTS.md` onder *Fabriek*. Daarnaast verbieden de
Claude Code-instellingen in de repo (`.claude/settings.json`) mergen, pushen naar `main` en
force-pushen. Dat is een extra vangrail naast de branch-regel op GitHub, geen waterdicht slot: het
verbod herkent een commando aan hoe het begint.
