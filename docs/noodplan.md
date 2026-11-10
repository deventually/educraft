# Noodplan LimeOnIt

Wat je doet als het misgaat. Kort en in volgorde; de achtergrond staat in het
[overdrachtsdocument](overdracht.md). Alle commando's draai je op de server, in de map met
`docker-compose.yml`.

**Eerst dit, altijd:**

1. Schrijf op wat je ziet en hoe laat (in een privé-notitie, niet in de repo of een issue: de repo
   is publiek).
2. Maak een back-up voordat je iets verandert, als de app nog draait:
   `docker compose exec app node build/ops/backup.js`
3. Zoek je situatie hieronder op. Twijfel je of het een datalek is, behandel het dan als een
   datalek (§4): de klok van 72 uur loopt vanaf het moment dat je het weet.

| Wat er aan de hand is | Ga naar |
| --- | --- |
| De app is niet bereikbaar of geeft fouten | [§1 Storing](#1-storing) |
| Data is weg of kapot, of een update ging mis | [§2 Data terugzetten](#2-data-terugzetten) |
| Niemand kan meer beheren (eigenaar weg, 2FA kwijt) | [§3 Weer binnenkomen](#3-weer-binnenkomen) |
| Iemand die het niet mocht, kon bij gegevens | [§4 Datalek](#4-datalek) |
| Een sleutel staat ergens waar hij niet hoort | [§5 Sleutel vervangen](#5-sleutel-vervangen) |
| De server of de schijf is kapot | [§6 Server kwijt](#6-server-kwijt) |

## 1. Storing

1. `docker compose ps`: draait `app`, en is hij `healthy`?
2. Open `/healthz`. `{"ok":false}` betekent: de database is onbereikbaar (vaak een volle schijf of
   verkeerde rechten op `LIMEONIT_DATA`).
3. `docker compose logs --tail 200 app`: zoek naar `unexpected_error` of een melding bij het
   opstarten, zoals `SESSION_SECRET must be set …`.
4. Herstarten: `docker compose up -d`. Helpt dat niet en kwam het na een update, rol dan terug
   (§2).
5. Werken de AI-tools niet maar de rest wel: kijk bij de modelaanbieder (storing, tegoed op,
   sleutel ingetrokken). *Beheer → Tools en modellen* toont of een aanbieder gekoppeld is.

Een docent die een fout meldt, ziet op de foutpagina het tijdstip; zoek dat op in de logs of op
*Beheer → Recente fouten*.

## 2. Data terugzetten

Een terugzetting vervangt de hele database: alles wat na die back-up gebeurde, is weg. Kies dus de
nieuwste back-up van vóór het probleem.

```sh
docker compose exec app ls /data/backups     # welke back-ups zijn er (als de app nog draait)
docker compose stop
docker compose run --rm app node build/ops/restore.js --from /data/backups/limeonit-<datum>T<tijd>Z.db
docker compose up -d
```

`restore.js` weigert een kapotte back-up en bewaart de vervangen database als
`limeonit.db.before-restore-<tijd>`. Ging een **update** mis, zet dan ook de vorige image terug
(migraties gaan alleen vooruit):
`LIMEONIT_IMAGE=limeonit:vorige docker compose up -d --no-build`. Zie
[Terugrollen](overdracht.md#4-terugrollen).

Controleer daarna `/healthz`, log in, en kijk of *Mijn werk* klopt.

## 3. Weer binnenkomen

| Probleem | Oplossing |
| --- | --- |
| De eigenaar is telefoon én herstelcodes kwijt | `docker compose exec app node build/ops/reset-2fa.js --email <eigenaar>`; daarna inloggen met alleen het wachtwoord en 2FA opnieuw instellen. |
| Een andere beheerder of docent is 2FA kwijt | De eigenaar zet het uit op de pagina van die persoon in *Beheer → Gebruikers*. |
| De eigenaar is weg of kan niet meer | Maak een beheerder: `docker compose exec app node build/ops/create-admin.js --name "…" --email …`, en maak die eigenaar: `docker compose exec app node build/ops/set-owner.js --email …`. |
| Een account moet nu dicht | De eigenaar of een beheerder deactiveert het in *Beheer → Gebruikers*; alle sessies van die persoon vervallen meteen. |

Elk van deze stappen komt in *Beheer → Logboek*.

## 4. Datalek

Een datalek is elke situatie waarin persoonsgegevens bij iemand kwamen die er niet bij mocht, of
kwijt of kapot raakten. Bij LimeOnIt zijn dat vooral: namen en e-mailadressen van docenten, en wat
docenten in tools zetten (dat kan werk van studenten zijn, soms van minderjarigen).

**Uur 0 tot 4: stoppen en vastleggen**

1. Leg vast: wat, sinds wanneer, welke gegevens, van hoeveel mensen (ongeveer), hoe je het merkte.
2. Stop het lek. Liever de app even uit (`docker compose stop`) dan dat het doorloopt.
3. Maak een back-up van de huidige toestand als bewijs, en bewaar hem apart en afgeschermd.
4. Waarschuw meteen de verwerkingsverantwoordelijke (zie [wie je belt](#7-wie-je-belt)). Draait
   LimeOnIt voor een school, dan is dat meestal de school, en is het jouw plicht om de school
   **zonder onnodige vertraging** te informeren; de school meldt dan bij de AP.

**Uur 4 tot 24: dichtzetten**

5. Vervang `SESSION_SECRET` (§5). Iedereen is daarna uitgelogd; nagemaakte cookies werken niet meer.
6. Vervang elke API-sleutel die in `.env` stond als `.env` of de server mogelijk gelekt is (§5).
7. Lekte **de database of een back-up**, dan ook:
   - Zet tweestapsverificatie uit voor iedereen die het had (de geheimen staan leesbaar in de
     database), en laat ze het opnieuw instellen. Per persoon op diens pagina, of met
     `node build/ops/reset-2fa.js --email …`. Er is geen knop voor iedereen tegelijk.
   - Trek open uitnodigingen in (*Beheer → Gebruikers*): wie de database heeft, kent hun links.
   - Open links voor wachtwoordherstel staan ook leesbaar in de database en blijven tot 48 uur
     geldig. Een nieuw wachtwoord voor een account maakt de open links van dat account ongeldig.
     Er is geen knop die ze voor iedereen tegelijk wist; laat de app desnoods dicht tot ze
     verlopen zijn.
   - Vraag iedereen een nieuw wachtwoord te kiezen. Wachtwoorden zijn gehasht (scrypt), maar een
     zwak wachtwoord is te raden. Er is geen knop om dat af te dwingen.
8. Lekte iets bij een **modelaanbieder** (zij hebben de tekst van AI-verzoeken): neem contact op met
   die aanbieder en vraag wat er met de gegevens gebeurd is.

**Binnen 72 uur: melden**

9. Een datalek met risico voor de betrokkenen meld je **binnen 72 uur** nadat het ontdekt is bij de
   Autoriteit Persoonsgegevens, via het meldloket datalekken op autoriteitpersoonsgegevens.nl
   (AVG artikel 33). Dat doet de verwerkingsverantwoordelijke. Weet je nog niet alles, meld dan
   wat je weet en vul later aan. Is het risico hoog, dan moeten ook de betrokkenen zelf het horen
   (artikel 34).
10. Registreer **elk** datalek, ook als het niet gemeld hoeft (artikel 33 lid 5): wat, gevolgen,
    maatregelen. Bewaar die registratie privé, niet in de repo.

**Daarna**

11. Zoek de oorzaak, los hem op met een test (TDD) en een PR, en zet de app weer aan.
12. Schrijf in een paar regels op wat er gebeurde en wat je verandert; een besluit gaat in
    [`fabriek/besluiten.md`](fabriek/besluiten.md), zonder namen of persoonsgegevens.

## 5. Sleutel vervangen

**`SESSION_SECRET`**

```sh
openssl rand -base64 48        # nieuwe waarde
# zet die in .env bij SESSION_SECRET
docker compose up -d           # niet "restart": dat leest .env niet opnieuw
```

Iedereen moet opnieuw inloggen; verder gaat er niets verloren.

**Een API-sleutel** (bijvoorbeeld `ANTHROPIC_API_KEY`)

1. Maak een nieuwe sleutel in de console van de aanbieder.
2. Zet hem in `.env` en draai `docker compose up -d`.
3. Controleer dat een AI-tool werkt.
4. Trek daarna de **oude** sleutel in bij de aanbieder, en kijk in het verbruik of er vreemd gebruik
   was.

Staat een sleutel per ongeluk in git (ook in een oude commit of een PR): vervang hem meteen. Weghalen
uit de geschiedenis is niet genoeg, want de repo is publiek en kopieën bestaan al.

## 6. Server kwijt

1. Zorg voor een nieuwe server met Docker, en zet `docker-compose.yml` en een nieuwe `.env` neer
   (gebruik deze kans om `SESSION_SECRET` en de API-sleutels te vervangen).
2. Haal de nieuwste back-up van **buiten** de oude server (zie de open vragen in het
   [overdrachtsdocument](overdracht.md#open-vragen-voor-bastiaan): als die er niet is, is de data
   weg).
3. Bouw of laad de image (`docker compose build`), zet de back-up neer en draai
   `docker compose run --rm app node build/ops/restore.js --from <pad naar de back-up>`.
4. `docker compose up -d`, controleer `/healthz`, en laat het domein naar de nieuwe server wijzen.

Volgens de [installatiegids](installatie-docker.md) stap 2 en 3 moet de map schrijfbaar zijn voor
gebruiker 1000 en moet er HTTPS voor.

## 7. Wie je belt

De namen en nummers staan **niet** hier (de repo is publiek), maar in de privé-overdrachtsmap.
Welke rollen erin moeten staan:

| Rol | Waarvoor |
| --- | --- |
| Bastiaan (ontwikkelaar, eigenaar) | Alles, als hij bereikbaar is. |
| Technische vervanger | Iemand met toegang tot de server en `.env`. |
| Verwerkingsverantwoordelijke en haar FG | Bij elk (mogelijk) datalek, meteen. |
| Contactpersoon van de pilot | Docenten laten weten dat de app plat ligt of dat ze opnieuw moeten inloggen. |
| Hostingpartij | Server of schijf kapot, toegang kwijt. |
| Modelaanbieder(s) | Sleutel misbruikt, lek aan hun kant. |

Wie dit zijn, is nog niet vastgelegd: zie de
[open vragen](overdracht.md#open-vragen-voor-bastiaan).
