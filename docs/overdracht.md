# Overdracht: LimeOnIt in beheer nemen

Voor wie LimeOnIt overneemt of tijdelijk waarneemt als Bastiaan er niet is. Lees dit eerst; bij
een storing, een datalek of een kapotte server ga je meteen naar het [noodplan](noodplan.md).

De repo is **publiek**. Daarom staat hier geen enkele sleutel, geen serveradres, geen naam en geen
telefoonnummer. Wat je daarvoor nodig hebt, staat in de **privé-overdrachtsmap** (zie
[open vragen](#open-vragen-voor-bastiaan)).

## 1. De app op één pagina

LimeOnIt is een webapp voor docenten: AI-tools uit *The Pedagogical Promptbook*, cursusontwerp en
een BDB/BKE-dossier. Technisch is het klein:

| Onderdeel | Wat het is | Meer |
| --- | --- | --- |
| App | Eén Node-proces: React Router 8 (server-side rendering), TypeScript | [Architecture](../wiki/Architecture.md) |
| Database | Eén SQLite-bestand (`/data/limeonit.db` in de container), Drizzle-migraties in `drizzle/` | [Deployment](../wiki/Deployment.md#volume-production-db-shape) |
| Draaien | Eén Docker-container met één volume (`docker-compose.yml`) | [Installatiegids](installatie-docker.md) |
| AI | Een taalmodel via een API-sleutel (standaard Anthropic Claude), achter `app/lib/ai/provider.ts` | [Architecture](../wiki/Architecture.md#providers-model-agnostic) |
| Inloggen | Alleen op uitnodiging, rollen `teacher` en `admin`, één eigenaar; tweestapsverificatie verplicht voor beheerders | [Authentication](../wiki/Authentication.md) |
| Dicteren (optioneel) | Een eigen Whisper-container naast de app (profiel `speech`) | [Installatiegids](installatie-docker.md#dicteren-optioneel) |
| AVG en AI Act | Wat al gebouwd is en wat een school zelf moet regelen | [Compliance](../wiki/Compliance.md) |

Er is **geen externe database, geen e-maildienst en geen andere SaaS**. Alles wat de app weet,
staat in dat ene SQLite-bestand. Wat de app naar buiten stuurt, is alleen de tekst van een
AI-verzoek naar de gekozen modelaanbieder.

Het kernidee van de code: **een tool is data** (`app/lib/registry/tools/<id>.ts`), geen eigen
code. De regels voor wie aan de code werkt, staan in [`AGENTS.md`](../AGENTS.md). Hoe het werk
wordt georganiseerd (Producer, werkers, het bord), staat in [`fabriek/`](fabriek/README.md).

## 2. Waar de geheimen staan

Alle geheimen staan in het bestand `.env` naast `docker-compose.yml` op de server, en nergens
anders. `.env` staat niet in git (`.env.example` wel, zonder waarden). De app leest ze bij de
start via `app/server/env.server.ts` en `config/models.json`.

| Variabele | Waarvoor | Wat als hij uitlekt |
| --- | --- | --- |
| `SESSION_SECRET` | Ondertekent het inlogcookie, het 2FA-tussencookie en de meldingen. 32+ tekens; zonder start de app niet in productie. | Iemand kan een inlogcookie namaken. Vervangen = iedereen is uitgelogd. |
| `ANTHROPIC_API_KEY` | Claude, de standaard. | Iemand gebruikt het model op jouw rekening. |
| `OPENAI_API_KEY` | ChatGPT, alleen als die aanbieder aan staat. | Idem. |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini, idem. | Idem. |
| `MISTRAL_API_KEY` | Mistral, idem. | Idem. |
| `MINIMAX_API_KEY`, `ZAI_API_KEY`, `XAI_API_KEY`, `QWEN_API_KEY` (met `QWEN_BASE_URL`), `TOGETHER_API_KEY`, `OPENCODE_ZEN_API_KEY`, `OPENROUTER_API_KEY` | Extra aanbieders uit `config/models.json`, idem. | Idem. |
| `OPENAI_COMPAT_API_KEY` | Een eigen OpenAI-compatibele server (met `OPENAI_COMPAT_BASE_URL`). | Idem. |
| `WHISPER_API_KEY` | Alleen als dicteren via een externe Whisper-dienst loopt. | Idem. |

Geen geheim, maar wel nodig: `APP_ORIGIN`, `DATABASE_URL` (vastgezet door `docker-compose.yml`),
`BACKUP_DIR`, `LIMEONIT_DATA`, `LIMEONIT_PORT`, `CLIENT_IP_HEADER` en de limieten. De volledige
lijst met uitleg staat in [Deployment](../wiki/Deployment.md#environment-checklist).

Er zijn nog drie plekken met iets geheims, buiten `.env`:

- **De database zelf.** Wachtwoorden staan er als scrypt-hash in (niet terug te rekenen). Maar de
  2FA-geheimen van de authenticator-apps en de links van open uitnodigingen en
  wachtwoordherstel staan er leesbaar in. Wie de database heeft, heeft dus meer dan alleen
  lesmateriaal: behandel elke kopie als vertrouwelijk.
- **De back-ups** in `/data/backups`: volledige kopieën van de database, niet versleuteld.
- **De accounts bij de modelaanbieders** (bijvoorbeeld console.anthropic.com), waar je sleutels
  maakt, intrekt en het verbruik ziet.

## 3. Deployen

Er is (nog) geen automatische deploy: wie een nieuwe versie uitrolt, doet dat met de hand op de
server. CI (`.github/workflows/ci.yml`) test alleen; `main` krijgt alleen code via een PR met
groene CI, en alleen Bastiaan merget.

Een update, op de server in de map met `docker-compose.yml`:

1. **Back-up maken:** `docker compose exec app node build/ops/backup.js`
2. **De huidige image bewaren voor terugrollen:** `docker tag limeonit:latest limeonit:vorige`
3. **Nieuwe versie ophalen en bouwen:** `git pull` en dan `docker compose build`
   (of een kant-en-klare image laden: `docker load < limeonit.tar.gz`).
4. **Starten:** `docker compose up -d`. Migraties lopen vanzelf bij de eerste databasetoegang.
5. **Controleren:** `/healthz` geeft `{"ok":true}` en `docker compose ps` zegt `healthy`. Loop
   daarna de [smoke-checklist](../wiki/Deployment.md#smoke-checklist-run-after-each-deploy) af.

Een gewijzigde `.env` (bijvoorbeeld een nieuwe sleutel) werkt pas na `docker compose up -d`;
`docker compose restart` leest `.env` **niet** opnieuw.

## 4. Terugrollen

Migraties gaan alleen vooruit: er bestaat geen "migratie ongedaan maken". Terugrollen is daarom
altijd **image én database samen**:

```sh
docker compose stop
docker compose run --rm app node build/ops/restore.js --from /data/backups/<back-up van vóór de update>.db
LIMEONIT_IMAGE=limeonit:vorige docker compose up -d --no-build
```

Alleen de image terugzetten zonder de database werkt zolang de update geen migratie had. Twijfel
je, zet dan ook de database terug. Werk dat docenten ná de update maakten, gaat daarbij verloren.

## 5. Back-up en terugzetten

De app maakt **zelf** elke dag een back-up, terwijl hij doorloopt (`app/server/backup.server.ts`,
gestart bij het opstarten). Hij gebruikt de online back-up van SQLite, schrijft eerst naar een
`.partial`-bestand en hernoemt pas als de kopie klaar is.

- **Waar:** `BACKUP_DIR`, anders `/data/backups` naast de database. `BACKUP_DIR=off` zet het uit.
- **Hoeveel:** de nieuwste van elk van de laatste 7 dagen, de nieuwste van elk van de laatste 4
  weken, en altijd de allernieuwste. Bestanden met een andere naam blijven staan.
- **Zien of het werkt:** *Beheer* toont de leeftijd van de nieuwste back-up (een waarschuwing na 36
  uur), de grootte van de database en de vrije schijfruimte. `docker compose exec app ls /data/backups`
  toont de bestanden.
- **Nu een back-up:** `docker compose exec app node build/ops/backup.js`
- **Terugzetten** (app gestopt): `docker compose run --rm app node build/ops/restore.js --from /data/backups/<bestand>.db`.
  `restore.js` controleert eerst of de back-up een gezonde database is en doet anders niets. De
  database die hij vervangt, blijft bewaard als `limeonit.db.before-restore-<tijd>`.

**Belangrijk:** de back-ups staan op dezelfde schijf als de database. Gaat de server of de schijf
kapot, dan zijn ze ook weg. Kopieer `/data/backups` dus ook van de server af. De app doet dat niet
zelf; zie de [open vragen](#open-vragen-voor-bastiaan).

## 6. Beheer zonder de beheerpagina's

Alles wat via de server moet, is een los script in de image (`build/ops/`):

| Commando | Wanneer |
| --- | --- |
| `docker compose exec app node build/ops/create-admin.js --name "…" --email …` | Een nieuwe beheerder, bijvoorbeeld als niemand meer kan inloggen. Toont één keer een wachtwoord. |
| `docker compose exec app node build/ops/set-owner.js --email …` | Een bestaande beheerder eigenaar (superbeheerder) maken. Er is er precies één; dit draagt het over. |
| `docker compose exec app node build/ops/reset-2fa.js --email …` | Tweestapsverificatie uitzetten voor wie telefoon én herstelcodes kwijt is. Komt in het auditlogboek. |
| `docker compose exec app node build/ops/invite.js --note "…"` | Een uitnodigingslink maken. |
| `docker compose exec app node build/ops/backup.js` / `restore.js --from …` | Back-up maken / terugzetten (zie hierboven). |
| `docker compose run --rm app node build/ops/migrate.js` | Migraties los draaien. |

Waar je kijkt als er iets mis is:

- `docker compose logs app`: één JSON-regel per AI-verzoek en per onverwachte fout, met een
  `requestId`. Nooit de inhoud van prompts of antwoorden.
- *Beheer → Recente fouten* (alleen de eigenaar): de laatste 50 fouten, leeg na een herstart.
- *Beheer → Logboek*: wie wiens toegang veranderde, een jaar lang bewaard.

## 7. Wat je moet weten over de organisatie

- Beslissingen staan in [`fabriek/besluiten.md`](fabriek/besluiten.md) (nieuwste wint), de stand
  van het werk op het [bord](fabriek/STATUS.md), wat Bastiaan wil in
  [`fabriek/voorkeuren.md`](fabriek/voorkeuren.md).
- Volgorde van waarheid bij twijfel: code en tests, dan `besluiten.md`, dan `STATUS.md`.

## Open vragen voor Bastiaan

Deze dingen weet de repo niet, en ze horen er ook niet in (de repo is publiek). Leg de antwoorden
vast in een **privé-overdrachtsmap** (bijvoorbeeld een gedeelde map of een wachtwoordkluis) die
een vervanger kan openen, en zet hier alleen waar die map te vinden is, zonder de inhoud.

1. **Waar draait productie?** Bij welke partij, welke server, welk adres (`APP_ORIGIN`), en wie
   kan erop inloggen (SSH)? Is er al een productie-instantie, of alleen lokaal?
2. **Wie kan er bij als jij er niet bent?** Wie heeft de sleutels van de server, het `.env`-bestand,
   de accounts bij de modelaanbieders, het domein en de GitHub-repo (eigenaar of beheerder)?
3. **Wie is de tweede eigenaar of beheerder in de app?** Nu is er één eigenaar; als die wegvalt,
   moet iemand met servertoegang `create-admin` en `set-owner` draaien.
4. **Gaan de back-ups al van de server af?** Zo ja: waarheen, hoe vaak, en is terugzetten ooit
   geprobeerd? Zo nee: wat wordt het?
5. **Wie is verwerkingsverantwoordelijke** voor de pilot (de school, of jij), en is er een
   verwerkersovereenkomst met de modelaanbieder en met de hostingpartij? Dat bepaalt wie een
   datalek meldt (zie het [noodplan](noodplan.md#4-datalek)).
6. **Wie bel je?** Namen en nummers van: de functionaris gegevensbescherming (FG) van de school,
   de contactpersoon bij de pilot, de hostingpartij, en een technische vervanger.
7. **Betaalt iemand anders de rekeningen** (hosting, API-verbruik, domein) als jij er niet bent, en
   wat gebeurt er als een betaling stopt?
