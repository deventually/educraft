# Fase 39 — Studieloopbaanbegeleiding (SLB): hulp in de groep, niet per student

> **Status:** ⚪ brief. 39.1 en 39.2 mogen nu; 39.3 na P38.3; 39.4 en 39.5 los
> (BESLUIT-2026-11-12-10, -12). Zo voer je deze brief uit: één deelstap per sessie, elke deelstap één
> PR vanaf `main`, test-first volgens `AGENTS.md` / de `/tdd`-skill, poort
> `npm test && npm run typecheck && npm run check`. Merge nooit zelf; alleen Bastiaan merget.
> Volgorde en gedeelde bestanden: `README.md`, *Docenthulpjes*.

## In gewone taal

SLB kan LimeOnIt goed dragen in de groep, en maar beperkt bij de individuele student. In
SLB-gesprekken gaat het vaak over gezondheid, thuis en geld; die gegevens moet LimeOnIt niet
bewaren. Studievoortgang en BSA staan al in Osiris. Daarom komt er **geen SLB-traject per student**
met gespreksverslagen (BESLUIT-2026-11-12-12). Wel vijf hulpjes:

| SLB-taak | Hulpje | Deelstap |
| --- | --- | --- |
| Een moeilijk gesprek voeren | SLB-scenario's in *Lastig gesprek oefenen*: een negatief BSA-advies brengen, een student die vastloopt, uitval bespreken | 39.1 |
| Een gesprek voorbereiden | Een vragenset per situatie: start, voortgang, dreigend negatief BSA, uitval, keuze voor minor of stage. Alleen de situatie, nooit de student | 39.2 |
| Reflecties en POP nakijken | Formatieve feedback op een reflectie of POP met een SLB-beoordelingsmodel, nooit een cijfer | 39.3 |
| Doorverwijzen | Een wegwijzer: welk loket voor welke vraag (decaan, studentpsycholoog, vertrouwenspersoon, studentendecaan voor een functiebeperking), ingevuld door de beheerder. Zonder AI | 39.4 |
| Groepsbijeenkomsten geven | SLB als cursus: zelfsturing, beroepsbeeld en studievaardigheden als leeruitkomsten, met de cursuswizard en *Les voorbereiden*. Werkt grotendeels al | 39.5 |

Herkomst: onderzoek "Docenttaken en hulpjes in LimeOnIt", deel *Studieloopbaanbegeleiding (SLB)*;
Bastiaan op het advies: "Ja".

## Vaste uitgangspunten

1. **Nooit de student zelf.** Geen veld vraagt naar een naam, een studentnummer of persoonlijke
   omstandigheden; de vragenset werkt met de situatie. Bij een vrij tekstveld staat "geen namen of
   persoonlijke gegevens", en de namencheck draait waar het veld studentwerk bevat.
2. **Geen advies over een BSA-besluit.** LimeOnIt helpt het gesprek voeren, niet het besluit nemen;
   de prompts zeggen dat en de evals toetsen het.
3. **Verwijzen doet een mens, niet een model.** De wegwijzer is data van de beheerder; een model
   noemt geen loket dat niet in de wegwijzer staat (39.4).
4. **Geen verzonnen kader** (BESLUIT-2026-05-31-1). Een SLB-beoordelingsmodel (bijvoorbeeld de
   reflectiecirkel van Korthagen of STARR) komt alleen als startmodel met een gecontroleerde bron;
   anders maakt de docent of de opleiding het model zelf.
5. **Tools zijn data.** Nieuwe scenario's zijn opties; de vragenset is één one-shot entry. Geen tak
   per situatie.

## Deelstappen

### 39.1 — SLB-scenario's in *Lastig gesprek oefenen*

- `app/lib/registry/tools/difficult-conversation.ts`: nieuwe opties bij `scenario` (Engelse slugs,
  bijvoorbeeld `negative-study-advice`, `student-stuck`, `dropout`). Verandert de prompttekst, dan
  een nieuwe versie (`difficult-conversation@v3`); `@v2` blijft geregistreerd.
- **Evals:** per nieuw scenario een case, plus een case waarin de oefenstudent om een BSA-besluit
  vraagt (de tutor neemt het niet).
- **RED:** de opties resolven, geen open `{{…}}`, NL/EN.

### 39.2 — Een vragenset per gesprekssituatie (`conversation-prep@v1`)

- Registry `app/lib/registry/tools/conversation-prep.ts`, one-shot. Invoer: `situation` (select:
  `start`, `progress`, `negative-study-advice`, `dropout`, `minor-or-internship-choice`), `phase`
  (propedeuse, hoofdfase), `goal` (vrij, kort, "geen namen"), `{{contextProfile}}`.
- Uitvoer: openingsvragen, doorvraagvragen, wat je niet vraagt, hoe je afsluit en afspraken maakt,
  en *Verwijs door* met de loketten uit de wegwijzer (39.4) als die er is.
- `next`: *Lastig gesprek oefenen* met hetzelfde scenario. En *Lastig gesprek oefenen* krijgt
  `conversation-prep` in `next`.
- **Evals:** vijf cases, twee met een bekende fout (een vraag naar gezondheid of thuissituatie zonder
  aanleiding; een advies over het BSA-besluit).

### 39.3 — Formatieve feedback op een reflectie of POP

- Een documenttype `reflection` (reflectieverslag, POP) bij de beoordelingsmodellen, en een
  startmodel alleen met een gecontroleerde bron (uitgangspunt 4).
- De feedback gebruikt de feedforward-prompt van P38.3 (geen niveau, geen cijfer), via *Studentwerk
  beoordelen* met dat model, met verplicht anonimiseren. Er wordt niets bewaard.
- Na P38.3: de feedforward-prompt moet er zijn. Kan het niet zonder een tak per documenttype, dan
  wordt "formatief" een eigenschap van het beoordelingsmodel (data), niet van de tool.

### 39.4 — De wegwijzer (zonder AI, geen migratie)

- De beheerder vult op Beheer → *Organisatie* een lijst in: per vraag (studievertraging, psychische
  klachten, functiebeperking, ongewenst gedrag, geld) het loket, een korte omschrijving en een link.
  Opslag in `instance_settings` (`app/server/repositories/settings.server.ts`), gevalideerd met Zod.
- De docent ziet de wegwijzer in het helponderwerp SLB en onder *Verwijs door* in 39.2. Een lege
  wegwijzer: "Je beheerder heeft nog geen loketten ingevuld."
- **RED:** de setter (alleen beheerder, Zod, caps), de weergave, axe.

### 39.5 — SLB als cursus (alleen help)

- Een helpsectie *SLB als cursus*: hoe je een SLB-lijn opzet met de cursuswizard (leeruitkomsten
  voor zelfsturing, beroepsbeeld, studievaardigheden), groepsbijeenkomsten met *Les voorbereiden*, en
  de wegwijzer. Geen code.

## Volgorde

39.1 en 39.2 eerst (klein, kunnen meteen, raken allebei `difficult-conversation.ts`, dus achter
elkaar). 39.4 los. 39.3 na P38.3. 39.5 mag mee in de PR van 39.4.

## Buiten deze fase

- Een SLB-traject per student, gespreksverslagen, studievoortgang (BESLUIT-2026-11-12-12).
- Een koppeling met Osiris.
