# LimeOnIt installeren met Docker

Deze gids is voor wie LimeOnIt op een eigen server of laptop wil draaien, zonder de
ontwikkelomgeving. Je hebt alleen **Docker** nodig (Docker Desktop of Docker Engine met
`docker compose`). Geen Node, geen npm, geen broncode-gereedschap.

LimeOnIt draait als één container. De database is één SQLite-bestand op een volume, dus je hoeft
geen databaseserver te beheren. Het taalmodel (LLM) koppel je met een API-sleutel in `.env`.

## 1. Wat je krijgt

Je hebt drie bestanden nodig, die in de repo staan:

| Bestand | Waarvoor |
| --- | --- |
| `docker-compose.yml` | Start de app, met poort, volume en herstart. |
| `.env.example` | Voorbeeld van de instellingen. Je kopieert hem naar `.env`. |
| `Dockerfile` | Alleen nodig als je de image zelf bouwt. |

Er zijn twee manieren om aan de image te komen:

- **Zelf bouwen** in een map met de repo: `docker compose build`. Daarna heb je de broncode niet meer
  nodig.
- **Een kant-en-klare image overnemen**, zonder broncode. Op de bouwmachine:
  `docker save limeonit:latest | gzip > limeonit.tar.gz`. Op de doelmachine:
  `docker load < limeonit.tar.gz`, en daarnaast alleen `docker-compose.yml` en `.env`.
  Haal op de doelmachine de regel `build: .` uit `docker-compose.yml`.

## 2. Instellen

Kopieer het voorbeeld en vul het in:

```sh
cp .env.example .env
```

Minimaal nodig:

| Variabele | Wat erin moet |
| --- | --- |
| `SESSION_SECRET` | Een lange willekeurige tekst (32+ tekens). Maak er een met `openssl rand -base64 48`. Zonder deze start de app niet. |
| `APP_ORIGIN` | Het adres waarop docenten de app openen, bijvoorbeeld `https://limeonit.school.nl`. Komt in uitnodigingslinks. |
| `ANTHROPIC_API_KEY` | De sleutel voor Claude (console.anthropic.com). |

Haal bij `SESSION_SECRET` en `APP_ORIGIN` het `#` aan het begin van de regel weg.

### Het taalmodel koppelen

- **Claude (Anthropic):** zet `ANTHROPIC_API_KEY`. Dit is de standaard.
- **Een ander model via een OpenAI-compatibele API** (bijvoorbeeld OpenRouter, Mistral, GLM,
  DeepSeek, of een eigen vLLM-server): zet `OPENAI_COMPAT_BASE_URL` en zo nodig
  `OPENAI_COMPAT_API_KEY`.
- **Welke modellen docenten zien**, kies je daarna in de app onder *Beheer → Modellen*.
- Lokale modellen (Ollama, LM Studio) en CLI-agents werken alleen in de ontwikkelomgeving, niet in
  de container.

Let op de AVG: een cloudmodel verwerkt de tekst buiten je eigen server. Zie `wiki/Compliance.md`.

### De database koppelen

De container bewaart de database altijd in `/data/limeonit.db` (`DATABASE_URL` wordt door
`docker-compose.yml` vastgezet). Je kiest alleen **waar** `/data` staat:

- Standaard: het Docker-volume `limeonit-data`. Niets te doen.
- Een map op de server (bijvoorbeeld op een schijf met back-up): zet `LIMEONIT_DATA=/srv/limeonit`
  in `.env`. De map moet schrijfbaar zijn voor gebruiker 1000:
  `sudo mkdir -p /srv/limeonit && sudo chown 1000:1000 /srv/limeonit`.

Een externe databaseserver (PostgreSQL, MySQL) wordt nog niet ondersteund.

Andere poort dan 3000? Zet `LIMEONIT_PORT=8080` in `.env`.

### Dicteren (optioneel)

Met een microfoonknop spreekt een docent tekst in, in de chat en in elk tekstvak. Een
Whisper-server (whisper.cpp) schrijft het uit, in een eigen container naast LimeOnIt, alleen
bereikbaar voor LimeOnIt. De opname gaat niet naar buiten en wordt niet bewaard.

1. Zet in `.env`: `WHISPER_BASE_URL=http://whisper:8178/v1`
2. Start met het profiel `speech`:

   ```sh
   docker compose --profile speech up -d
   ```

De eerste start downloadt het model (standaard `large-v3-turbo-q5_0`, ongeveer 550 MB) naar het
volume `whisper-models`; dat duurt even. Docker draait op de processor, ook op een Mac (Docker
heeft daar geen toegang tot de GPU). Is uitschrijven te traag, kies dan een kleiner model met
`WHISPER_MODEL=small-q5_1` in `.env`. Zonder het profiel draait LimeOnIt gewoon, zonder
microfoonknop. De browser geeft de microfoon alleen via HTTPS (of op `localhost`).

## 3. Starten

```sh
docker compose up -d
```

De migraties lopen vanzelf bij de eerste start: een leeg volume krijgt meteen de goede tabellen.
Wil je ze los draaien, bijvoorbeeld na een update en vóór de eerste gebruiker:

```sh
docker compose run --rm app node build/ops/migrate.js
```

**Gebruik HTTPS** zodra de app niet alleen op `localhost` draait. In productie is het
inlogcookie `Secure`: via `http://<server-ip>:3000` lukt inloggen dan niet. Zet er een
reverse proxy met een certificaat voor (bijvoorbeeld Caddy, Traefik of nginx) en laat
`APP_ORIGIN` naar dat `https://`-adres wijzen.

Controleer of de app leeft: open `http://localhost:3000/healthz`. Je ziet `{"ok":true}`.
`docker compose ps` toont ook `healthy`.

## 4. De eerste beheerder

Maak een beheerder aan en maak hem eigenaar (superbeheerder):

```sh
docker compose exec app node build/ops/create-admin.js --name "Jouw Naam" --email jij@school.nl
docker compose exec app node build/ops/set-owner.js --email jij@school.nl
```

`create-admin` toont een gegenereerd wachtwoord. Bewaar het meteen, het komt niet terug. Log in op
`APP_ORIGIN/login`. Docenten nodig je uit in de app (*Beheer → Gebruikers*), of met:

```sh
docker compose exec app node build/ops/invite.js --note "Jan de Vries"
```

## 5. Bijwerken

```sh
docker compose build      # of: docker load < limeonit.tar.gz
docker compose up -d
```

Maak **vóór** een update een back-up van de database (zie hieronder). Migraties lopen bij de start.

## 6. Back-up en terugzetten

Back-up van het volume naar `backup/limeonit-<datum>.tar.gz`:

```sh
docker compose stop
docker run --rm -v educraft_limeonit-data:/data -v "$PWD/backup":/backup alpine \
  tar czf /backup/limeonit-$(date +%F).tar.gz -C /data .
docker compose start
```

De naam van het volume begint met de mapnaam van je project (`docker volume ls` toont hem).
Terugzetten: stop de app, pak het archief uit in hetzelfde volume en start weer. Gebruik je
`LIMEONIT_DATA`, kopieer dan gewoon die map terwijl de app stilstaat.

## Problemen

| Wat je ziet | Oplossing |
| --- | --- |
| `SESSION_SECRET must be set …` | Vul `SESSION_SECRET` in `.env` in (en haal het `#` weg). |
| `/healthz` geeft `{"ok":false}` | De database is niet schrijfbaar. Controleer de rechten van `LIMEONIT_DATA`. |
| Een tool meldt dat de sleutel ontbreekt | Zet de sleutel van die aanbieder in `.env` en herstart: `docker compose up -d`. |
| Inloggen lukt niet, je blijft op de inlogpagina | Je opent de app via `http://` op een ander adres dan `localhost`. Zet HTTPS ervoor (zie stap 3). |
| Uitnodigingslinks wijzen naar `localhost` | Zet `APP_ORIGIN` op het echte adres. |

Meer achtergrond voor ontwikkelaars: [`wiki/Deployment.md`](../wiki/Deployment.md).
