# Fase 22 — De week van de docent: dashboard, geplande briefings, ICS (STUB / nog niet afgebakend)

> **Status:** ⚪ stub. Hij legt de bedoeling vast, zodat de fase koud kan worden opgepakt. **Hangt af
> van P20** (cursussen); P21 is optioneel (bevindingen in de briefing). Branch vanaf `main`.

## Waarom dit bestaat

Derde stap van het docentassistentspoor: de assistent houdt een **ritme** aan in plaats van te
wachten tot er iets gevraagd wordt. Nakijken, deadlines en hiaten in het cursusplan moeten naar de
docent komen, niet andersom.

## Schets (niet definitief)

1. **Echte datums:** voeg een cursus-`startDate` toe, zodat de relatieve weken van P20 op
   kalenderweken worden afgebeeld (vakanties/blokken kunnen een latere verfijning zijn).
2. **Dashboard "Deze week"** (de landingspagina van de docent): de activiteiten en toetsen van
   deze week over de cursussen van de docent heen, openstaande afstemmingsbevindingen en recent
   gekoppeld werk.
3. **Jobrunner:** een `jobs`-tabel plus een in-process tick-worker. Eén instantie en
   database-per-tenant maken dat verstandig. Elke job is begrensd (time-out, maximum aantal
   pogingen, idempotent), en de worker stopt netjes bij afsluiten. **Dit is de planner die de latere
   Cases-add-on hergebruikt** voor vertraagde personagereacties, dus houd hem generiek.
4. **Zondagbriefing:** een geplande job stelt per docent een wekelijkse briefing samen (de
   activiteiten van volgende week, wat nog niet gekoppeld of niet getoetst is, P21-bevindingen als
   die er zijn). Eerst in de app bezorgd; e-mail is later opt-in.
5. **ICS-export** van een cursusrooster (alleen-lezen feed), in plaats van agenda-OAuth.

## Buiten bereik

Terugschrijven naar de agenda/OAuth; pushmeldingen; studentgerichte roosters; de Cases-add-on.
