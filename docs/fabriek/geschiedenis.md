# Geschiedenis en lessen

> De korte geschiedenis van LimeOnIt: wat er gebouwd is en vooral **waarom**, plus de lessen die je
> niet in de code terugziet. Dit is **achtergrond, geen instructie**. Wat nu geldt staat in
> `besluiten.md` en `STATUS.md`. Details per fase staan in de briefs in `docs/implementation/`.
>
> Geoogst op 2026-11-03 uit git (125 commits), de briefs, de ADR's en het werkgeheugen van eerdere
> Claude Code-sessies.

## Tijdlijn

### Mei 2026: van idee naar vijftien tools

- **29 mei, start** als "EduCraft", later omgedoopt tot **LimeOnIt**. De eerste versie had vier
  docenttools uit *The Pedagogical Promptbook*. Het kernidee lag vanaf dag één vast: **tools zijn
  data** (één `Tool`-vorm, `stages[]` voor meerstapstools), en prompts staan als NL/EN-markdown
  naast de letterlijke boektekst.
- Dezelfde dag kwamen erbij:
  - **i18n:** NL standaard, EN als tweede taal, en de uitvoertaal los van de UI-taal;
  - **providers:** AI SDK voor Claude, plus lokale modellen die automatisch ontdekt worden en
    CLI-agents;
  - **visie:** "één app, de verschillen zijn data" (`docs/VISION.md`).
- **S1–S7 (29–30 mei):** het testfundament (TDD, vitest-axe, `AGENTS.md`, `/tdd`-skill), daarna
  chat-infrastructuur, beeldinvoer en alle **14 boektools in twee dagen**, steeds via koud
  uitvoerbare briefs.
- **30–31 mei:** een helpsysteem (afgeleid uit het register, plus Markdown-aanvullingen) en
  **contextprofielen met domeinpakketten**: HBO-i en andere landelijke kaders, alleen met bron.

### Juni 2026: verfijnen op echt gebruik

- **Beoordelingsassistent stage & afstuderen** (15e tool, eigen ontwerp, geen boekhoofdstuk).
  Daarvoor kwam er upload van PDF/DOCX met tekstextractie in de browser. Het HBO-i-nakijkmodel is
  een standaard die je kunt aanpassen.
- **Contextprofiel afgeslankt:** competenties, notities en de domeinregel gingen uit de prompt.
  Daarnaast **vulden profielvelden de tool vooraf in**, zodat niveau en studiejaar niet dubbel
  gevraagd worden.
- **URL-slugs naar het Engels** (bijv. `/tools/authentic-assessment`), terwijl de UI Nederlands
  bleef.
- **Huisstijl "Grove"** (groen, bij het limoenlogo) verving "Atelier" (amethist). De toolkop werd een
  compacte commandobalk.
- Kleiner werk: de taalwissel midden in een chat werkt nu echt, en er kwamen juridische pagina's.

### Juli 2026: audit en het P-programma (P0–P15)

- **Audit (3 juli)** → `docs/Audit-2026-07.md` en `docs/Improvement-Plan.md`. De grootste gaten:
  - de stream-endpoint was onbeveiligd en zonder limieten;
  - er was geen autorisatie;
  - er waren geen evaluaties en geen CI.
- **P0–P2:**
  - beveiliging: Zod aan de grens, limieten, CSP;
  - uitnodigingslinks, rollen en scoping per gebruiker;
  - logging, quota, feedback, en de vorm voor de AI Act.
- **P3:**
  - het prompt-sjabloon (`TEMPLATE.md`, met *Voice & Bounds*);
  - **EQF 1–8** als universele niveau-as;
  - een evaluatie-harnas. ⚠️ De **nulmeting is nooit gedraaid.**
- **P4–P5:** de beheerconsole, inhaalslag op tests, vitest 4 en AI SDK 7. De upgrade naar React
  Router 8 is bewust uitgesteld.
- **P6–P7:**
  - de **studentenlaag**: cohorten, studentuitnodigingen, één actieve sessie per account;
  - **privacyveilig mentorinzicht**: de docent ziet nooit letterlijke gesprekken.
- **P8–P12:** de onderwijscontext werd vo/mbo/hbo/wo met NLQF→EQF, havo/vwo-profielen,
  onder- en bovenbouw, en beschikbaarheid per land, sector en domein, per instelling en per docent.
- **P13–P14:** modelbeheer per docent en per cohort, lokale modellen die ook beheerd worden, en een
  omkeerbaar verwijderverzoek voor studenten.
- **P15:** toasts als feedback op acties, en navigatie-toegankelijkheid (skiplink, aankondiging van
  paginawissels).

### Najaar 2026

- **Niet gecommit, wel klaar:** de upgrade naar Claude Sonnet/Opus 5.5 en een documentlimiet van
  300k tekens.
- **November: koerswijziging.**
  - Van gereedschapskist naar **assistent voor docenten**.
  - **Eerst vereenvoudigen:** de studentenlaag eruit, de beheerlagen terug.
  - Werken als **softwarefabriek** (`docs/fabriek/`).

## Lessen

**Inhoud en prompts**

1. **Verzin nooit een kader.** Domeinpakketten komen alleen uit een landelijke bron. Waar die
   ontbreekt (mbo, wo, sommige hbo-domeinen) gebruiken we eerlijk eigen velden in plaats van een
   verzonnen taxonomie.
2. **Minder context geeft betere uitvoer.** Een vol profiel verdunde de taak: alle opties van een
   pakket aangevinkt *zegt niets*. Het afslanken (een vol ICT-profiel ging van 840 naar 223 tekens)
   verloor geen informatie en maakte de uitvoer scherper.
3. **De invoer van de tool weegt zwaarder dan de context.** De zwakke ARCS-resultaten kwamen door
   verwarrende invoervelden, niet door het profiel.
4. **Vraag niets twee keer.** Wat het profiel weet, vult de tool vooraf in. Hetzelfde feit in twee
   bewoordingen verwart het model.
5. **Stille fouten in prompts:**
   - `{{contextProfile}}` moet precies één keer voorkomen, anders wordt hij dubbel ingevoegd;
   - drie tools hadden `usesContextProfile` aan maar geen placeholder, waardoor het profiel stil
     wegviel.

   Beide worden nu door tests bewaakt.
6. **Beoordelaars op temperatuur 0,3.** Een cijfer hoort niet te variëren door toeval.
7. **Zonder nulmeting weet je niet of een promptwijziging helpt.** De evaluatie-harnas staat
   klaar, maar is nooit gedraaid. Dat is openstaande schuld.

**Architectuur**

8. **De abstracties hielden stand.** De upgrade naar AI SDK 7 vroeg geen enkele wijziging in de
   adapter.
9. **Doorsnede tegenover overrule.** Bij een doorsnede (instelling ∩ docent) gaf een lege uitkomst
   via de lockout-fallback stilletjes *de hele catalogus* vrij. Daarom kreeg context in P12 een
   overrule. Let bij elke beheerlaag op wat "leeg" betekent.
10. **Een omweg langs het eigenaarschap vraagt om een eigenaarschapscheck.** Bij cohorten kon een
    docent via de membership-route het profiel van een collega lekken. Dat is in P6 gevonden en
    gerepareerd.
11. **Bouw beheer pas als een echte gebruiker erom vraagt.** P8–P14 voegden lagen toe (per land,
    sector, domein, docent en cohort) voor scenario's die de pilot niet had. Die complexiteit is de
    reden voor de vereenvoudiging van november.

**Werkwijze**

12. **Briefs werken.** "Plannen in de ene sessie, bouwen in een verse sessie" met koud uitvoerbare
    briefs leverde 14 tools in twee dagen en P0–P15 in een week.
13. **Kijk eerst naar de machine, dan naar de code.** In een ander project bleven achtergrondprocessen
    uren draaien, waardoor timing-tests massaal faalden. Faalt een cluster tests ineens, kijk dan eerst
    naar `uptime` en wees wees-processen. Zie de globale werkafspraken.
14. **De docent blijft examinator.** De beoordelingstools zijn onder de AI Act hoog risico (Annex
    III). Ze adviseren, de docent beslist (`assistiveGrading`).
