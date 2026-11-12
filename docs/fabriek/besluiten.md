# Besluitenlog

Korte, gedateerde besluiten over richting en werkwijze van LimeOnIt. Eén regel per besluit, met de
reden als die niet vanzelf spreekt. Grotere architectuurbesluiten krijgen daarnaast een ADR in
`docs/adr/`. Een besluit vervalt alleen door een nieuw besluit dat ernaar verwijst.

## Eerder (mei–juli 2026), geoogst

Besluiten uit eerdere sessies die nog gelden, of die expliciet vervangen zijn. Achtergrond per besluit
in `geschiedenis.md` en de genoemde brief of ADR.

- **BESLUIT-2026-05-29-1:** **Eén app** voor alle sectoren en landen. De verschillen zijn data
  (pakketten), geen aparte apps (`docs/VISION.md`).
- **BESLUIT-2026-05-29-2:** **Tools zijn data.** Eén `Tool`-vorm, geen besturingslogica per tool.
  Prompts staan als NL/EN-markdown naast de letterlijke boektekst (CC BY).
- **BESLUIT-2026-05-29-3:** Werken met **koud uitvoerbare briefs** in `docs/implementation/`:
  plannen in de ene sessie, bouwen in een verse.
- **BESLUIT-2026-05-30-1:** `wiki/` is **ontwikkeldocumentatie**. Hulp voor gebruikers staat in
  `app/content/help/` (tweetalig, getoond via `/help` en inline).
- **BESLUIT-2026-05-31-1:** **Verzin nooit een kader.** Domeinpakketten alleen met een landelijke
  bron; anders eerlijk eigen velden.
- **BESLUIT-2026-06-1:** **URL-slugs zijn Engels**, ook al is de UI Nederlands.
- **BESLUIT-2026-06-2:** Huisstijl **"Grove"** (groen), via de tokens in `app/app.css`.
- **BESLUIT-2026-07-03-1:** Commercieel: eerst een **proefrit op uitnodiging**, daarna **on-prem per
  instelling** (SSO zoals SURFconext later). Een eventuele SaaS-variant wordt
  **database-per-tenant** (`docs/Tenancy-and-Admin.md`).
- **BESLUIT-2026-07-03-2:** Inloggen via **uitnodigingslinks**. **Beheerders worden nooit via een
  uitnodiging gemaakt**, alleen via `npm run create-admin` of promotie.
- **BESLUIT-2026-07-03-3:** **Rollen, geen multi-tenancy** binnen een instantie. Database blijft
  SQLite, met **async repositories** als seam en scoping per gebruiker.
- **BESLUIT-2026-07-03-4:** **AI Act:** de beoordelingstools zijn hoog risico (Annex III). Ze
  adviseren, de docent beslist (`assistiveGrading`), met transparantie in de UI.
- **BESLUIT-2026-07-05-1:** **EQF 1–8** is de niveau-as van de engine. Nationale labels (NLQF) zijn
  alleen voor de UI.
- **BESLUIT-2026-07-05-2:** Prompts worden vóór de lancering ter plekke aangepast. Vanaf de eerste
  echte uitrol geldt **versiebeheer met `@v2`**.
- **BESLUIT-2026-07-05-3:** De **studentenlaag via cohorten** (ADR 0001).
  **Vervangen door BESLUIT-2026-11-03-3.**
- **BESLUIT-2026-07-06-1:** **po geschrapt.** De sectoren zijn vo/mbo/hbo/wo.
- **BESLUIT-2026-07-06-2:** De upgrade naar **React Router 8 is uitgesteld** tot er E2E-tests zijn.
- **BESLUIT-2026-07-06-3:** Contextbeschikbaarheid per docent als **overrule** (P12).
  **Vervangen door BESLUIT-2026-11-03-15.**
- **BESLUIT-2026-07-07-1:** Modelbeheer als **doorsnede**: instelling → docent → cohort (P13–P14).
  **Vervangen door BESLUIT-2026-11-03-7.**

## 2026-11

- **BESLUIT-2026-11-02-1:** LimeOnIt wordt eerst een **assistent voor docenten**: cursussen en de
  rode draad (alignment), rolagenten die adviseren, een weekritme en later spraak.
- **BESLUIT-2026-11-02-2:** AI-ondersteunde cursussen en praktijksimulaties (zoals Webshop Bob, met
  fotorealistische avatars) komen **later**, als **aparte add-on** op hetzelfde platform. De kern
  importeert nooit uit de add-on.
- **BESLUIT-2026-11-02-3:** **hbo eerst.** De engine blijft sector- en landneutraal.
- **BESLUIT-2026-11-02-4:** Agenten **adviseren, maar wijzigen en publiceren nooit** zonder klik
  van de docent. Eerst beoordeling op verzoek, later uit zichzelf signaleren.
- **BESLUIT-2026-11-02-5:** "Wat er in moet" = **pakket als basis** (bijv. HBO-i) **plus een laag
  van de docent**. Een sectie- of teamlaag komt later.
- **BESLUIT-2026-11-03-1:** **Taal:** gesprekken en ontwikkeldocumentatie Nederlands; code en
  commentaar Engels; alles wat gebruikers lezen tweetalig NL/EN (later meertalig). Bestaande Engelse
  ontwikkeldocumentatie wordt vertaald wanneer we hem aanraken.
- **BESLUIT-2026-11-03-2:** **Engels blijft** in de app.
- **BESLUIT-2026-11-03-3:** **De studentenlaag gaat eruit** (studentrol, cohorten,
  studentuitnodigingen, mentorinzicht, verwijderverzoek, vergrendelde modus, één actieve sessie). Er
  hoeft geen studentdata bewaard te worden. Hij komt later beter terug, als dat nodig is.
- **BESLUIT-2026-11-03-4:** **De studenttutors blijven**, als tools waarmee docenten zelf leren
  (bijv. BDB/BKE-trajecten).
- **BESLUIT-2026-11-03-5:** De **examencommissie** krijgt geen eigen rol. De leden gebruiken de app
  als docent.
- **BESLUIT-2026-11-03-6:** **Weg wat overbodig is.** Liever eenvoudiger, efficiënter en
  doeltreffender bouwen dan alles behouden.
- **BESLUIT-2026-11-03-7:** **Modellen:** de beheerder stelt ze per instelling in en kan
  dat **per docent overrulen** (vervangen, dus ook ruimer dan de instelling). De
  cohortlaag verdwijnt met de studentenlaag. *Definitief gemaakt door BESLUIT-2026-11-03-16.*
- **BESLUIT-2026-11-03-8:** Het project wordt gestuurd als **softwarefabriek**.
  *Aangescherpt door BESLUIT-2026-11-03-9.*
- **BESLUIT-2026-11-03-9:** De fabriek is het **lichte broertje van any1-studio**: één **Producer**
  (het Claude-project LimeOnIt, elke thread) met werkers per taak. Geen Architect, afdelingen,
  issue-backlog of dashboard. Het oude werkordermodel (KOERS/IDEE/BRIEF…) vervalt. Zie
  `producer.md`.
- **BESLUIT-2026-11-03-10:** De Producer praat **Nederlands en ELI5**, begint elk bericht met 🍋 en
  **bouwt nooit zelf**. Elk stuk werk eindigt in één PR, en **alleen Bastiaan merget**.
- **BESLUIT-2026-11-03-11:** De Producer start op **autonomiestand 2 (opdracht)**, met hooguit twee
  werkers tegelijk. Meer autonomie volgt na bewezen vertrouwen (`voorkeuren.md`).
- **BESLUIT-2026-11-03-12:** De repo is **publiek**. Daarom wordt `main` beschermd met een
  branch-regel (PR + groene CI, geen force-push), en komt er niets in de repo dat niet openbaar mag.
- **BESLUIT-2026-11-03-13:** Studentdata bij V1 wordt **definitief gewist** (17.3). **Uitloggen op alle
  apparaten na een nieuw wachtwoord blijft**; inloggen op meerdere apparaten tegelijk mag.
- **BESLUIT-2026-11-03-14:** **Beheer gaat van acht naar vier pagina's**: Gebruikers, Tools en
  modellen, Onderwijscontext, Gebruik en feedback. Beheer **slaat automatisch op**, met een melding,
  in plaats van een opslaan-knop per regel. **"Bekijk als docent" verdwijnt.** Uitwerking: P18.
- **BESLUIT-2026-11-03-15:** **Geen toegang per docent meer** voor tools en onderwijscontext: elke
  docent ziet wat de instelling aanzet. **De land-as verdwijnt**; alleen sector en domein blijven.
  De pakketdata blijft per land opgeslagen, als seam voor later. Vervangt BESLUIT-2026-07-06-3.
- **BESLUIT-2026-11-03-16:** **Modellen per instelling, met een overrule per docent.** Een eigen set
  van een docent **vervangt** de instelling en mag ruimer zijn; zonder eigen set volgt de docent de
  instelling. CLI- en lokale modellen alleen in ontwikkelmodus. Maakt BESLUIT-2026-11-03-7 definitief.
- **BESLUIT-2026-11-03-17:** Er is één **superbeheerder** (Bastiaan). Alleen hij maakt beheerders,
  maakt ze weer docent en verwijdert ze; beheerders kunnen dat niet. **Uitnodigingen maken nooit
  beheerders.** De superbeheerder kan ook accounts direct aanmaken (met een eenmalige link of een
  beginwachtwoord, zonder e-mail), wachtwoorden resetten of instellen, en accounts op non-actief
  zetten en weer activeren.
- **BESLUIT-2026-11-03-18:** **Toolnamen: taak eerst, boeknaam als ondertitel (V3).** Elke tool heet
  naar wat de docent wil doen (bijvoorbeeld 'Stageverslag of afstudeerwerk beoordelen'); de naam uit
  het boek of de techniek staat klein eronder (`Tool.subtitle`). Slugs, ids en prompts blijven gelijk.
- **BESLUIT-2026-11-04-1:** Wie beheerder wordt (of weer docent), wordt **overal uitgelogd** en moet
  opnieuw inloggen. Een bestaande docentsessie mag niet stilletjes een beheerderssessie worden
  (beveiligingsreview 18.6). Dezelfde rol opnieuw instellen doet niets.
- **BESLUIT-2026-11-04-2:** **Startpagina en Over: weg wat dubbel is (V3, vraag 1 van P19).**
  Bastiaan koos de aanbeveling. Weg: het typefilter ("Generators / Chatbots"), de knop raster/lijst,
  de theorieregel onderaan elke kaart (de theorie blijft doorzoekbaar en staat op de toolpagina) en
  de toollijst op "Over" (die staat al op de startpagina). Zoeken en de vijf doelen vinden elke tool.
  Uitwerking: brief P19, stap 19.2.
- **BESLUIT-2026-11-04-3:** **Menu: vier items, zonder contactpagina (V3, vraag 2 van P19).** Het
  docentmenu heeft vier items: Tools · Mijn werk · Onderwijscontext · Help (voor een beheerder vooraf
  Beheer). "Over" staat alleen onderaan. "Projecten" heet "Mijn werk"; de route blijft `/projects`.
  De lege contactpagina gaat weg; het e-mailadres in de footer blijft. Uitwerking: brief P19, stap 19.5.
- **BESLUIT-2026-11-04-4:** **Contextformulier: vijf velden open, de rest onder "Meer details" (V3,
  vraag 3 van P19).** Open, in deze volgorde: Naam, Onderwijstype, Opleiding, Vak, en Studiejaar (in
  het vo: Fase). Het vinkje "Als standaard instellen" staat onder de velden. Onder "Meer details
  (optioneel)", dicht: niveau, domein en kader, beroepspraktijk, technologie, onderwijsconcept,
  aanspreekvorm (mbo) en eigen velden. Uitwerking: brief P19, stap 19.6.
- **BESLUIT-2026-11-04-5:** **Hulpmiddelen zonder AI krijgen een eigen plek.** Naast de AI-tools
  komen rekenhulpen die geen LLM gebruiken (eerst de cijfer- en cesuurrekenaar en rubrics bewaren en
  invullen). Ze zijn geen `Tool` in het register maar hebben een eigen klein register. Bastiaan: "Ja
  geef ze een eigen plek". Uitwerking: brief P23. Achtergrond: het onderzoek naar ontbrekende
  docententools van 2026-11-04.
- **BESLUIT-2026-11-04-6:** **Hulpmiddelen staan op de toolspagina**, als eigen sectie onder de
  tools, zonder eigen menu-item. Brief P23.
- **BESLUIT-2026-11-04-7:** **Acht nieuwe AI-tools, eerst meten.** Bastiaan koos alle acht AI-tools
  uit het onderzoek (feedback op studentwerk door Stage Assessment breder te maken, rubric maken,
  toetsvragen en toetsmatrijs, les voorbereiden, toetsanalyse, opdracht helder schrijven,
  differentiëren, lastig gesprek oefenen) en koos om eerst de nulmeting te draaien. Elke tool moet een
  meetbare kwaliteitslat halen. Uitwerking: brief P24.
- **BESLUIT-2026-11-04-8:** **Ingevulde rubrics: namen lokaal, daarna anoniem.** Namen en opmerkingen
  staan alleen in de browser van de docent en gaan nooit naar de server of een LLM. Bij het afsluiten
  van een batch blijven alleen de gekozen niveaus per criterium over, zonder code en zonder datum per
  invulling, voor meetdoeleinden. De privacy-officer bevestigt dit één keer. Brief P23.3.
- **BESLUIT-2026-11-04-9:** **Anonimiseren vóór het versturen.** Elke tool die studentwerk leest,
  vervangt in de browser namen en andere gegevens door codes voordat er iets naar de LLM gaat; de
  docent geeft aan wat weg moet en kijkt het na, en de browser zet de namen in het resultaat terug.
  Brief P24, stap 24.0b.
- **BESLUIT-2026-11-04-10:** **Het origineel naast de tekst.** Bij een geüpload PDF- of Word-document
  ziet de docent het origineel naast de tekst die naar de AI gaat, en kan hij vanuit een citaat in het
  resultaat naar de plek in het origineel springen. Alles blijft in de browser; het origineel wordt
  niet opgeslagen. Brief P24, stap 24.0c.
- **BESLUIT-2026-11-04-11:** **BDB en BKE krijgen een eigen deel van de app**, de werkplaats, dat de
  bestaande tools mag inzetten. Uitwerking: brief P25.
- **BESLUIT-2026-11-04-12:** **Coachen of schrijven is een keuze van de docent.** Standaard coacht de
  werkplaats. Laat de docent tekst opstellen, dan past de docent die aan en draagt de docent de
  verantwoordelijkheid. Hooguit één neutrale melding; LimeOnIt leest de docent niet de les.
- **BESLUIT-2026-11-04-13:** **Scores van studenten worden standaard geanonimiseerd** bij het
  importeren; de docent kan dat uitzetten.
- **BESLUIT-2026-11-04-14:** **Het BDB/BKE-cursusmateriaal van Bastiaan** (van een BDB-opleiding,
  2025-2026) mag gebruikt worden als achtergrond en voor evals. Niets ervan komt in de repo of de
  app (auteursrecht); privé-evaldata staat buiten de repo.
- **BESLUIT-2026-11-04-15:** **Export naar Word mag**, ook met een nieuwe dependency (`docx`).
- **BESLUIT-2026-11-04-16:** **Importeren uit TestVision, ANS en Remindo** hoort bij de werkplaats,
  zodat toetsresultaten meegaan in de documentatie voor de leeruitkomsten. Uitwerking: brief P25 (vervolg).
- **BESLUIT-2026-11-04-17:** **Het menu krijgt een vijfde item "BDB/BKE"** voor de werkplaats. Vult
  BESLUIT-2026-11-04-3 aan; de andere vier items blijven.
- **BESLUIT-2026-11-04-18:** **Eval-runs mogen geld kosten** (ongeveer €1–3 per run), voor de
  nulmeting en de evals van de BDB/BKE-tools.
- **BESLUIT-2026-11-04-19:** **Bastiaan lost nooit zelf een merge-conflict op.** Na elke merge brengt
  de Producer `main` in alle andere open PR's en lost hij de conflicten op voordat Bastiaan kijkt
  (`producer.md`, *Na elke merge*). Om conflicten te voorkomen zijn de schermteksten en de routes
  opgesplitst in één bestand per onderdeel (`app/lib/i18n/messages/{nl,en}/<onderdeel>.ts`,
  `app/routing/<onderdeel>.ts`). Squash-mergen mag; vervolgwerk start dan op een verse branch.
- **BESLUIT-2026-11-04-20:** **Namen bij anonimiseren alleen in het geheugen van de pagina.** Wat de
  docent invult om te anonimiseren (24.0b) staat niet in de browseropslag; na herladen is het weg en
  vult de docent het opnieuw in. De privacy-officer kijkt later mee; tot dan staan de grenzen eerlijk
  in de UI. Bastiaan, 2026-11-04.
- **BESLUIT-2026-11-04-21:** **Stage Assessment heet voortaan "Studentwerk beoordelen en feedback
  geven"** (EN: "Assess student work and give feedback"), omdat de tool met 24.1 elk geschreven
  studentwerk beoordeelt. De slug blijft `stage-assessment`; de ondertitel noemt stage en afstuderen,
  zodat zoeken op "stage" hem blijft vinden. Vervangt voor deze tool de naam uit P19.1. Bastiaan,
  2026-11-04.
- **BESLUIT-2026-11-04-22:** **We mogen afwijken van de prompt uit het boek, maar zeggen het eerlijk.**
  De app toont dan het origineel uit het boek (de echte tekst, met paginanummer), zegt per tool in
  gewone taal wat wij veranderden en waarom, en noemt een wijziging pas een verbetering als een
  meting dat laat zien (met datum en rapport in `evals/reports/`). Waar we de boektekst niet hebben,
  heet het "samenvatting van de aanpak in het boek", niet "verbatim". Bastiaan, 2026-11-04.
- **BESLUIT-2026-11-04-23:** **Een promptwijziging wordt gemeten met drie runs per case en harde
  ja/nee-checks** (`--runs 3`, `## Hard checks` in de rubric). Een verschil kleiner dan de spreiding
  telt als ruis. Advies Producer na de tweede meting, waarin de beoordelaar een leeg antwoord 3,6 gaf.
- **BESLUIT-2026-11-04-24:** **Een nieuwe tool is klaar na de meting als elke case gemiddeld 4,5 of
  hoger scoort, geen harde check faalt en geen uitvoer is afgekapt.** Haalt de meting dat niet, dan
  volgt nog één verbeterronde. Het streven blijft 5,0. Een ronde mag geen regressie geven: geen
  case of criterium zakt verder dan de spreiding onder de vorige meting van dezelfde tool, anders gaat
  die wijziging terug. Na twee rondes stopt het en staat de uitslag eerlijk in de PR. Vervangt
  voor de P24-tools de lat "minstens het nulmetingsgemiddelde van Stage Assessment (≈ 5,0) per
  criterium" uit de brief. Bastiaan, 2026-11-04.
- **BESLUIT-2026-11-04-25:** **Metingen goedkoper: tussenrondes met 1 run, en alles via de Batch
  API.** Alleen de eindmeting van een tool draait met 3 runs. `npm run eval -- --batch` stuurt
  genereren en beoordelen via de Message Batches API van Anthropic, die de helft kost; de uitslag
  duurt dan iets langer. Samen ongeveer 60–70% minder per tool. Bastiaan, 2026-11-04.
- **BESLUIT-2026-11-05-1:** **P20 krijgt studielast en geldt ook voor de nieuwe tools; de rest gaat
  naar P26.** De cursus krijgt een EC-waarde en uren per activiteit en toets, met een advies als de
  uren boven EC × 28 uitkomen. Het voorinvullen van leeruitkomsten geldt ook voor de P24-tools.
  Toetsmatrijs per vraag, importeren uit een OER en de koppeling met het BDB/BKE-dossier komen in een
  eigen vervolgbrief (P26). Bastiaan, 2026-11-05.
- **BESLUIT-2026-11-05-2:** **Cursussen verder (P26): importeren, Bloom-voorstel, momentopname.** Uit
  een OER of studiehandleiding importeren we leeruitkomsten én toetsen (naam, soort, weging, week). De
  AI mag bij import een Bloom-niveau voorstellen, zichtbaar als voorstel dat de docent bevestigt. Een
  cursus komt als momentopname in het BDB/BKE-dossier, met "Opnieuw ophalen", geen live koppeling.
  Bastiaan, 2026-11-05. Uitwerking: brief P26.
- **BESLUIT-2026-11-05-3:** **Rolagenten (P21): twee petten, alleen meningen krijgen knoppen.** Een
  Toetsdeskundige en een Ontwerper kijken een cursus na op verzoek. De vaste P20-controles krijgen geen
  knoppen; pet-bevindingen krijgen Akkoord / Niet akkoord, dat alleen wordt vastgelegd, en een
  verworpen bevinding komt niet terug. Pakket-tags voor elk pakket. De pet draait op de modellen die
  de docent aangeboden krijgt. Gekoppeld werk mee laten nakijken is een keuze per keer, nooit
  automatisch, eerst alleen toetsvragen. Bastiaan, 2026-11-05. Uitwerking: brief P21.
- **BESLUIT-2026-11-05-4:** **Eén workflow: de cursus is de thuisbasis, drie ingangen op één
  startscherm, BDB/BKE doet mee.** Tools vertrekken uit de cursus of het dossier en het resultaat komt
  daar terug, met een volgende stap. Vraagvak, *Deze week* en cursussen staan samen op de
  Start-pagina; de docent kiest per moment, niet via een instelling. Wat een docent voor zijn cursus
  maakt, wordt zonder omweg bewijs in zijn dossier; het dossier krijgt een route in vijf stappen. Het
  menu gaat naar Start · Cursussen · BDB/BKE · Tools. Geen LLM in P27; tot de pilot geen nieuwe
  AI-tools; P26.3 (OER-import) direct na P20. Een beheerder blijft op de gebruikerslijst landen. De
  BDB/BKE-werkplaats staat per docent aan of uit, standaard uit; de beheerder zet hem aan (wie al
  een dossier heeft, staat aan). Bastiaan, 2026-11-05. Uitwerking: brief P27.
- **BESLUIT-2026-11-05-5:** **Teams: privé tenzij gedeeld, teamleiders, aan/uit per team.** Alles
  van een docent blijft privé tot hij een cursus, rubric of onderwijscontext deelt met een team;
  teamleden bekijken en kopiëren, alleen de eigenaar bewerkt. Het BDB/BKE-dossier, ingevulde rubrics,
  chats en werk van tools die studentwerk verwerken zijn nooit deelbaar. Een docent mag in meer
  teams. Beheerders en teamleiders beheren een team; een teamleider kan een ander lid teamleider
  maken. Onderdelen, tools en modellen gaan aan of uit in drie lagen (instelling, team, uitzondering
  per docent); de BDB/BKE-schakelaar per docent uit P27.2 wordt daarin de uitzondering per docent,
  en P28.1–28.3 komen vóór P27.3. Privacy: akkoord zonder extra toets. Bastiaan, 2026-11-05.
  Uitwerking: brief P28.
- **BESLUIT-2026-11-05-6:** **Een beheerder heeft de BDB/BKE-werkplaats altijd**, los van de
  schakelaar per docent, zodat niemand zichzelf buitensluit. Bastiaan, 2026-11-05 (P27.2, #88).
- **BESLUIT-2026-11-05-7:** **De week van de docent (P22) zonder planner.** De zondagbriefing is het
  blok *Volgende week* op Start, vanaf vrijdag, berekend bij het openen. Geen jobrunner, geen AI;
  de jobrunner komt pas mee met e-mail of de Cases-add-on. Vakantieweken zijn één lijst voor de hele
  instelling, ingevuld door de beheerder. De agenda is een `.ics`-bestand per cursus om te downloaden,
  geen feed met een geheime link. Bastiaan, 2026-11-05. Uitwerking: brief P22.
- **BESLUIT-2026-11-05-8:** **Het proefassessment mag vóór de pilot, als onderdeel van BDB/BKE.**
  Een uitzondering op "tot de pilot geen nieuwe AI-tools" (BESLUIT-2026-11-05-4): het staat niet in
  de toolcatalogus, alleen in stap 5 van de werkplaats, en gaat mee aan en uit met de werkplaats.
  Bastiaan, 2026-11-05. Uitwerking: brief P29.
- **BESLUIT-2026-11-05-9:** **Rood blokkeert de export niet** (behalve een open plek: BESLUIT-2026-11-07-4). De inleverklaar-check (P29.1) is
  alleen advies; een docent kan altijd exporteren. Bastiaan, 2026-11-05 (keuzekaart).
- **BESLUIT-2026-11-05-10:** **Van een proefassessment bewaren we alleen de feedback**, en alleen
  als de docent op "Bewaar in je dossier" klikt. Het gesprek zelf wordt nergens bewaard, ook niet
  als project. Bastiaan, 2026-11-05 (keuzekaart). Uitwerking: P29.3.
- **BESLUIT-2026-11-05-11:** **Rolagenten staan aan of uit voor de hele instelling, niet per team.**
  Bastiaan, 2026-11-05 (keuzekaart).
- **BESLUIT-2026-11-06-1:** **De sleutels (API-keys) van AI-aanbieders blijven op de server**
  (`.env`), niet in de database of het beheerscherm. Het scherm laat alleen zien of een aanbieder
  gekoppeld is; de beheerder voegt daar modellen aan toe, upgradet ze en faseert ze uit. Bastiaan,
  2026-11-06 (keuzekaart, #139).
- **BESLUIT-2026-11-06-2:** **Een beheerder kan in het scherm een aanbieder toevoegen**, maar de
  sleutel blijft in `.env` (BESLUIT-2026-11-06-1). De naam van de instelling volgt uit de naam van
  de aanbieder (`DeepSeek` → `DEEPSEEK_API_KEY`) en mag nooit die van een andere aanbieder zijn,
  zodat een sleutel niet naar een vreemd adres kan. Adressen op internet zijn `https`; een eigen
  server op het schoolnetwerk mag `http` en zonder sleutel, ook in productie. Bastiaan, 2026-11-06.
- **BESLUIT-2026-11-06-3:** **Pilotfeedback:** onder elk resultaat een duim, dan optioneel tijdwinst
  (0/15/30/60+ min), kwaliteit 1-5 en een opmerking. De pilot-check-in staat op Start, komt na 3
  resultaten en daarna hooguit eens per 14 dagen; "Niet nu" telt ook. Het beheeroverzicht per tool
  is te filteren per team. Bastiaan, 2026-11-06 (#142).
- **BESLUIT-2026-11-06-4:** **Twee nieuwe bibliotheken voor export: Excel en PowerPoint.** Voor
  de export naar Excel en PowerPoint mogen er twee bibliotheken bij (`exceljs` en `pptxgenjs`,
  beide MIT). Een derde, om een geüpload PowerPoint-sjabloon te vullen, is apart te vragen.
  Bastiaan, 2026-11-06. Uitwerking: brief P30.
- **BESLUIT-2026-11-06-5:** **Export: Word en PDF nu, de rest na de pilot.** P30.1 en P30.2 (Word
  en PDF voor elk resultaat, geen nieuwe bibliotheek) mogen vóór de pilot; Excel, PowerPoint,
  Brightspace en de huisstijl volgen na de pilotfeedback. Bastiaan, 2026-11-06 (keuzekaart).
  **PowerPoint: vervangen door BESLUIT-2026-11-12-13.**
- **BESLUIT-2026-11-07-1:** **Bijlagen F en G uit het boek worden brief P31:** een tutor voor de
  mondelinge verdediging van eigen werk (F) en de leercheck met de zes leerprincipes (G). Allebei
  mogen nu, vóór de pilot: een uitzondering op "tot de pilot geen nieuwe AI-tools"
  (BESLUIT-2026-11-05-4). Het nakijken van een verdediging (31.2): zie BESLUIT-2026-11-07-2.
  Bastiaan, 2026-11-07 (keuzekaart). Uitwerking: brief P31.
- **BESLUIT-2026-11-07-2:** **De AI mag de verdediging van een student nakijken (P31.2)**, als advies
  (de docent beslist, AI Act) en alleen na anonimiseren in de browser: naam, studentnummer, bedrijf,
  begeleiders en genoemde klanten of patiënten. Nooit gedeeld. Bastiaan, 2026-11-07.
- **BESLUIT-2026-11-07-3:** **Verdedig je werk krijgt een vinkje "Student plakt eerst de
  kerncijfers"** (prompt `defend-your-work@v2`, standaard uit). De tutor vraagt dan na de opening
  om een paar cijfers of bevindingen uit het eigen werk, zonder namen, en vraagt daarop scherper
  door. Nooit het hele verslag: dan leest de AI de antwoorden mee en kan de student erop leunen,
  en een stageverslag staat vol namen. Bastiaan, 2026-11-07 ("Ja").
- **BESLUIT-2026-11-07-4:** **Een open plek komt nooit in het ingeleverde BDB/BKE-werk.** Een
  open plek is `[aanvullen: …]` / `[to add: …]` (zoals een opgestelde alinea die achterlaat),
  `[invullen]`, TODO, een leeg hoofdstuk of bewijs zonder tekst ("volgt nog"). Zolang er een staat,
  geeft de Word-export geen echte versie, alleen een conceptversie die je niet kunt verwarren met
  de echte: CONCEPT, NIET INLEVEREN boven en onder elke pagina en op de titelpagina, "(concept)"
  in de bestandsnaam, elke open plek geel. Een uitzondering op BESLUIT-2026-11-05-9 (rood
  blokkeert de export niet), alleen voor open plekken. Bastiaan, 2026-11-07 ("Ik wil het wel
  kunnen exporteren, maar dan moet het wel HEEL ERG DUIDELIJK zijn dat het een concept betreft").
- **BESLUIT-2026-11-07-5:** **Open plekken mogen in het BDB/BKE-dossier zelf** (plan BDB en BKE,
  PR 3). Het landelijke startpunt mag je bevestigen als *voorlopig kader*: coach, alinea's en
  proefassessment werken, en elk oordeel zegt "op het landelijke startpunt". Een bewijsstuk zonder
  tekst heet *Volgt nog* en telt niet als bewijs. Een voorlopig kader is een open plek in de zin
  van BESLUIT-2026-11-07-4: dan geeft de export alleen de conceptversie. Bastiaan, 2026-11-07
  ("Akkoord op PR 3 en 4").
- **BESLUIT-2026-11-09-1:** **Inloggen: een oplopend slot, nooit automatisch deactiveren**
  (doorlichting P0-1, #174). Na 5 foute wachtwoorden voor één e-mailadres gaat dat adres op slot:
  15 minuten, en elk volgend slot twee keer zo lang, tot hooguit 24 uur. Een goede login of een
  dag zonder fouten zet het terug op 15 minuten. Automatisch deactiveren niet, want dan kan
  iedereen die een e-mailadres kent een collega buitensluiten tot de beheerder ingrijpt.
  Bastiaan, 2026-11-09 (keuze "Oplopend slot, max 24 uur").
- **BESLUIT-2026-11-09-2:** **"Overal uitloggen" mag `sessionVersion` verhogen** (doorlichting
  P1-4). Op `/account` kan een docent op alle eigen apparaten tegelijk uitloggen, ook op het apparaat
  waarop de knop wordt ingedrukt. Dat is de vierde plek waar `sessionVersion` omhoog gaat, naast een
  nieuw wachtwoord, deactiveren en een echte rolwijziging (AGENTS.md). Tegelijk verloopt een
  sessie na 8 uur zonder activiteit (glijdend) in plaats van na 30 dagen; cookies van vóór deze
  wijziging gelden als verlopen, dus iedereen logt na de uitrol één keer opnieuw in.
  Bastiaan, 2026-11-09 ("Doe het maar").
- **BESLUIT-2026-11-09-3:** **Tweestapsverificatie met een authenticator-app** (doorlichting
  P2-12). TOTP (RFC 6238), geen sms of e-mail. Verplicht voor beheerders en de eigenaar: zonder
  gaan de beheerpagina's niet open; optioneel voor docenten. Iedereen krijgt 10 herstelcodes, elk
  één keer bruikbaar. Alles kwijt: de eigenaar zet het uit op de pagina van die persoon; de eigenaar
  zelf via `node build/ops/reset-2fa.js --email …`. Aanzetten, uitzetten, resetten en inloggen met
  een herstelcode komen in het logboek. Voor de QR-code mag het pakket `uqr` erbij. Uitzetten of
  resetten verhoogt `sessionVersion` **niet**: het geeft geen toegang erbij, dus de regel van vier
  plekken blijft. Bastiaan, 2026-11-09 (besluiten in de P2-planning; keuze "Ja, klein pakket (uqr)").
- **BESLUIT-2026-11-10-1:** **Meer petten, en de docent kiest zelf welke meekijken.** Vervangt
  "een derde pet pas als de pilot erom vraagt" uit BESLUIT-2026-11-05-3. Er komen vier petten bij,
  elk in een eigen PR: AI-bestendigheid, Werkveld, Student en Inclusie. De docent vinkt in het
  beoordelingspaneel aan welke petten meekijken; de keuze geldt voor al zijn of haar cursussen. De
  schakelaar per pet van de beheerder blijft en gaat voor. Toetsdeskundige en Ontwerper staan voor
  een docent standaard aan, nieuwe petten standaard uit. Elke pet krijgt een eigen stuk in de
  helppagina *Rolagenten*. De Examencommissie (een toetsprogramma over meerdere cursussen) wordt
  een aparte flow, niet eerder dan na de pilot of bij een tweede pilot; Bastiaan beslist dat nog.
  Bastiaan, 2026-11-10 (plan "Nieuwe rolagenten en examencommissie", akkoord op alle aanbevelingen).
- **BESLUIT-2026-11-10-2:** **Docenten lezen "Reviewteam", niet "rolagenten" of "petten".** Het
  idee erachter is het vier-ogenprincipe. Het onderdeel en de helppagina heten *Reviewteam*
  (Engels *Review team*), elke rol is een *reviewer* met een vaknaam (Toetsdeskundige, Ontwerper),
  de vraag in het paneel is *Wie zit in je reviewteam?* en de knop *Laat reviewen*. De helppagina
  staat op `/help/review-team`. In de code blijft het `agents`. Bastiaan, 2026-11-10 (keuzekaart,
  na "rolagenten is geen goede benaming").
- **BESLUIT-2026-11-10-3:** **Een opleiding is van een team; een cursus erin zetten deelt hem.**
  Een opleiding (laag 1) bundelt cursussen, met per cursus jaar en periode; een leerlijn (laag 2)
  is een geordende reeks cursussen binnen een opleiding. De teamleider of een beheerder maakt een
  opleiding aan en past hem aan; elk teamlid leest hem. Een teamlid zet alleen **eigen** cursussen
  erin, en deelt ze daarmee met dat team (het bestaande delen van P28.4). Een collega ziet een
  cursus in de opleiding alleen zolang dat delen bestaat: stoppen met delen, het team verlaten of de
  cursus verwijderen haalt hem eruit. Uithalen mag de eigenaar of de teamleider; het delen blijft
  dan staan. Een cursus kan in meer opleidingen staan (voltijd, deeltijd), elk met een eigen jaar en
  periode. Een master is een eigen opleiding; een minor hoort bij de opleiding die hem aanbiedt. Een
  team mag alles zijn: faculteit, opleiding, richting, module. Overdragen en samen bewerken van een
  cursus is apart werk. Bastiaan, 2026-11-10 (keuzekaart "Van wie is een opleiding?", optie "Van
  een team").
- **BESLUIT-2026-11-10-4:** **Vakgebiedpakketten voor mbo en wo.** Bij mbo is het vakgebied de
  **kwalificatie** (crebo), gegroepeerd per opleidingsdomein; het pakket haalt kerntaken en
  werkprocessen uit het kwalificatiedossier van SBB, zonder beheersingsniveau (het mbo-niveau is
  het niveau). Bij wo geldt één sectorpakket met de Dublin-descriptoren voor elk domein; de
  vakgebiedlijst is de tien CROHO-onderdelen. **Licentie:** kwalificatiedossiers worden door de
  minister van OCW vastgesteld bij ministeriële regeling, dus naar onze lezing rust er geen
  auteursrecht op (art. 11 Auteurswet) of mogen ze hergebruikt worden (art. 15b); dat is genoeg om
  te bouwen. **Open punt:** later nog bij SBB verifiëren dat we codes en titels mogen overnemen.
  De bouw gaat in twee PR's: eerst vakgebiedlijsten, een sectorbrede engine en het Dublin-pakket;
  daarna de mbo-proefpakketten. Bastiaan, 2026-11-10 (advies "Vakgebiedpakketten mbo en wo").
- **BESLUIT-2026-11-10-5:** **Een cursus heeft één eigenaar, en daarnaast mede-eigenaars en
  bewerkers; het eigenaarschap is over te dragen.** Vult BESLUIT-2026-11-05-5 aan ("alleen de
  eigenaar bewerkt"). Een *bewerker* leest en wijzigt de inhoud van de cursus, koppelt eigen werk en
  laat het reviewteam kijken. Een *mede-eigenaar* mag daarnaast de cursus delen met een eigen team en
  mede-eigenaars en bewerkers kiezen, uit collega's met wie hij of zij een team deelt
  (`course_members.role`). Alleen de eigenaar verwijdert de cursus, kiest de onderwijscontext en
  draagt het eigenaarschap over; de ontvanger is meteen eigenaar, zonder accepteren, en de vorige
  eigenaar blijft standaard bewerker. De beheerder kan dit ook, zodat een cursus niet verweest als
  een docent wegvalt. Gekoppeld werk en reviews blijven van wie ze maakte. Delen met een team blijft
  alleen lezen en kopiëren. Rubrics en onderwijscontexten houden alleen de eigenaar. Bastiaan,
  2026-11-10 (keuzekaarten in de thread "Cursussen overdragen en samen bewerken").
- **BESLUIT-2026-11-11-1:** **Wie ziet welk AI-gebruik.** Er komt één pagina *Gebruik* waar
  elke rol een andere kring ziet. De docent ziet zijn eigen gebruik. Een **teamleider ziet alleen
  teamtotalen** per tool en model, nooit cijfers per docent (dat zou een volgsysteem voor personeel
  zijn, met instemming van de OR). **Beheer** ziet het gebruik per docent en ook de **kosten**. De
  eigenaar ziet daarbovenop het budget en de maandprognose. Bastiaan, 2026-11-11 (keuzekaart "Mag
  een teamleider het AI-gebruik per docent zien?", optie "Nee, alleen teamtotalen"; en in de thread
  "Dashboard voor AI-gebruik en kosten ontwerpen").
- **BESLUIT-2026-11-11-2:** **AI-gebruik meten per gebruiker, dag, tool en model.** Tabel
  `ai_usage` met invoer-, cache-lees-, cache-schrijf-, uitvoer- en denktokens, voor elke aanbieder
  gelijk getrokken (`normalizeUsage`). Alleen tellers: geen inhoud en geen tijdstip. Chats tellen
  mee. Prijzen komen per model (euro per miljoen tokens, als momentopname bij het opslaan). Limieten
  per team en per docent worden een maandlimiet in euro's, niet in tokens, omdat een token per model
  tot twintig keer anders kost. Het meten verhuist uit het werk aan prompt caching naar het
  dashboard. Bastiaan, 2026-11-11 (thread "Dashboard voor AI-gebruik en kosten ontwerpen").
- **BESLUIT-2026-11-11-3:** **Meta loopt via Together AI; aanbieders buiten de EU houden de
  bouw niet tegen.** Meta biedt zelf geen API meer aan (de Llama API stopte in juli 2026), dus
  Muse Spark Open staat in de catalogus via Together AI (#249). Een school installeert LimeOnIt
  zelf en kiest zelf haar aanbieder, dus de privacy-officer hoeft niet per aanbieder vooraf te
  kijken. **Voor later:** de online versie voor kleinere instellingen krijgt een goede disclaimer
  over waar de gegevens heen gaan, ook over hoe lang een aanbieder een prompt in zijn cache bewaart
  (OpenAI zonder zero data retention: tot 24 uur). Bastiaan, 2026-11-11 (thread "Jev als System 1").
- **BESLUIT-2026-11-11-4:** **Prijzen per model: de prijslijst in de catalogus, een eigen prijs
  op het scherm.** Elk model in `config/models.json` krijgt de lijstprijs van de aanbieder per
  miljoen tokens, met de dag van opzoeken en de bronpagina, en een wisselkoers van de ECB voor
  dollars. Beheer kan per model een eigen prijs zetten (een schoolcontract); die gaat voor. Een
  aanroep krijgt de prijs van dat moment mee. De skill `/model-prices` houdt de lijstprijzen bij,
  voor elke release; een vaste maandelijkse routine komt er pas als Bastiaan dat wil. Bastiaan,
  2026-11-11 (thread "Dashboard voor AI-gebruik en kosten ontwerpen": "Dit is teveel om bij te
  houden anders").
- **BESLUIT-2026-11-11-5:** **Releases met een SemVer-tag, uitrollen met één commando.** Een
  release is een tag `vX.Y.Z` op `main`, die alleen Bastiaan zet; Claude-sessies mogen geen tag
  of release maken. De versie staat in `package.json` en in `RELEASE.md`, met de datum en notes in
  gewone taal. Major: wie zelf installeert, moet iets met de hand doen; minor: iets nieuws (ook
  met een migratie die vanzelf loopt); patch: alleen herstel. De tag bouwt de image op
  `ghcr.io/deventually/educraft:X.Y.Z` en een GitHub Release. Op de VPS (Strato, Caddy, Docker)
  rolt `./deploy.sh X.Y.Z` uit: back-up, starten, wachten tot `/healthz` die versie meldt.
  Terugrollen gebeurt nooit vanzelf. Geen staging tot na de pilots. Skills krijgen een Engelse naam:
  `/release` en `/maintenance` komen nu, `/model-prices` uit het werk aan het kostendashboard, en
  `/sources` (externe kaders nalopen, met een controledatum per pakket) na de pilot.
  Bastiaan, 2026-11-11 (thread "Releaseproces en onderhoudsskills adviseren").
- **BESLUIT-2026-11-11-6:** **AI-gebruik per persoon blijft 13 maanden.** Daarna rolt de server
  de rijen in `ai_usage` op tot maandtotalen per tool en model, voor de hele instelling en per
  team, zonder persoon (`ai_usage_rollup`), en wist hij de rijen per persoon. Dertien maanden is
  een schooljaar plus dezelfde maand vorig jaar, precies wat de pagina *Gebruik* laat kiezen.
  Bastiaan, 2026-11-11 (thread "Dashboard voor AI-gebruik en kosten ontwerpen": "Bewaartermijn …
  JA").
- **BESLUIT-2026-11-11-7:** **Een skill voor toegankelijkheid, geen aparte voor security.**
  `/accessibility-review` loopt een scherm door zoals een toetsenbord- of schermlezergebruiker
  (toetsenbord, focus, menu- en dialoogpatronen, namen, meldingen, herschikken bij zoomen,
  formulieren), omdat axe maar een deel van de WCAG-problemen vindt. Voor security volstaat de
  ingebouwde `/security-review` naast CodeQL, `npm audit`, secret scanning en de
  architectuurtests. Beide zijn verplicht: `/security-review` bij een PR die repositories, auth,
  sessies of `/api` raakt, `/accessibility-review` bij een PR die verandert wat een gebruiker
  ziet, en allebei in `/release` over alles sinds de vorige tag (`AGENTS.md`). Voor echte scholen
  blijft een menselijke audit nodig. Bastiaan, 2026-11-11 (thread "Releaseproces en
  onderhoudsskills adviseren").
- **BESLUIT-2026-11-11-8:** **Limieten per maand in euro's.** De eigenaar zet een budget per
  maand voor de hele instelling; beheer zet een limiet per maand per team en per docent. De eigen
  limiet van een docent vervangt die van zijn teams; het budget telt altijd. Vanaf 80% ziet de
  docent een waarschuwing, bij 100% stopt de AI tot de volgende maand. Een docent ziet een
  percentage, nooit euro's. Beheerders hebben geen limiet. De daglimiet van 50 aanroepen
  vervalt: één limiet voor de docent is helderder. Als stille rem op een op hol geslagen dag
  blijven de 200.000 uitvoertokens per dag en 10 aanroepen per minuut; die staan op geen pagina.
  Bastiaan, 2026-11-11 (thread "Dashboard voor AI-gebruik en kosten ontwerpen": "Doe het maar",
  en op de kaart "Alleen tokens, onzichtbaar").
- **BESLUIT-2026-11-11-9:** **Browsertests tijdelijk alleen lokaal.** De GitHub-runner kon
  Chromium niet installeren (archive.ubuntu.com onbereikbaar), dus de e2e-job was rood. De job
  draait nu alleen als de repositoryvariabele `E2E_IN_CI` op `true` staat; zonder die variabele
  slaat GitHub hem over, en een overgeslagen job telt voor de ruleset als geslaagd. Zolang hij uit
  staat draait de werker `npm run test:e2e` zelf, automatisch en zonder dat iemand erom vraagt, bij
  elke PR die `app/`, `e2e/`, `playwright.config.ts` of de dependencies raakt, en zet de uitslag in
  de PR (het sjabloon vraagt erom; `AGENTS.md` zegt hoe in een sandbox). Bastiaan kijkt op
  2026-11-12 of het weer via GitHub kan. Weer aan: de variabele `E2E_IN_CI` = `true` zetten, zonder PR. Bastiaan, 2026-11-11
  (thread "Playwright e2e tijdelijk alleen lokaal": "Kunnen we playwright e2e tijdelijk uitzetten op
  github en het alleen lokaal draaien?" en "je moet het waar nodig automatisch lokaal draaien,
  totdat het op github weer opgelost is").
- **BESLUIT-2026-11-12-1:** **Browsertests weer op GitHub, bij elke PR.** Vervangt
  BESLUIT-2026-11-11-9. Oorzaak van het rood: `npx playwright install --with-deps chromium`
  wilde via `apt-get` nog negen lettertypepakketten installeren, en de Ubuntu-mirrors waren vanaf de
  runner onbereikbaar (DNS); alle andere bibliotheken die Chromium nodig heeft stonden er al. De job
  installeert Chromium nu zonder `--with-deps`, dus zonder `apt-get`, en draait standaard. Noodknop:
  de repositoryvariabele `E2E_IN_CI` op `false`; dan slaat GitHub de job over en draait de werker
  `npm run test:e2e` weer zelf. Bastiaan, 2026-11-12 (thread "Playwright e2e op GitHub weer laten
  draaien": "Ik wil kijken of de playwright e2e op github het weer doet, zodat we de PR's daar weer
  volledig kunnen draaien").
- **BESLUIT-2026-11-12-2:** **Eén omgeving is één instelling; daarbinnen een tussenlaag met een
  eigen naam.** LimeOnIt komt in drie soorten: geïnstalleerd bij een instelling, online met een
  abonnement voor kleinere instellingen, en een demo voor sales. Bij alle drie is één omgeving (één
  database) precies één instelling; een online abonnee krijgt dus een eigen database
  (BESLUIT-2026-07-03-1 blijft). De beheerders van een omgeving beheren alleen die instelling; de
  eigenaar is daar de hoogste beheerder. Boven de omgevingen komt later een platformbeheerder
  (Bastiaan) die omgevingen aanmaakt en de eerste eigenaar aanwijst, buiten elke database van een
  instelling. Een "school per gebruiker" is daarom niet nodig. Binnen een instelling zit tussen
  instelling en opleiding een **optionele tussenlaag** (onderdeel) waarvan de instelling zelf kiest
  hoe hij heet: faculteit, academie, instituut, college, vestiging of afdeling (een vo-bestuur kiest
  vestigingen, een hogeschool faculteiten). Een opleiding valt onder hooguit één onderdeel; de
  beheerder zet hem daar op Beheer → Organisatie. Opleidingen blijven van een team
  (BESLUIT-2026-11-10-3); iemand aan een opleiding koppelen is hem in het team van die opleiding
  zetten. Een leerlijn kan bij meer opleidingen horen (voltijd en deeltijd, een onderzoekslijn door
  een faculteit) en komt terug op de cursuspagina; dat volgt in eigen PR's. Wie bij twee
  instellingen werkt, heeft een account per instelling; eigen materiaal gaat mee via exporteren en
  importeren, later via SSO per instelling. Een vestiging en een faculteit tegelijk (een ROC-college
  op meer locaties) krijgt later een optionele lijst locaties per opleiding. Bastiaan, 2026-11-12
  (thread "School, faculteit, opleiding en leerlijn beheren": "Mijn plan is om twee soorten
  LimeOnIt aan te bieden" en "Als iedere instelling beheerder(s) krijgt, dan zijn de beheerders dus
  alleen voor die instelling en 1 database").
- **BESLUIT-2026-11-12-3:** **SQLite per instelling; een andere database is maatwerk.** Standaard
  is één SQLite-bestand per instelling, ook online; er komt geen gedeelde database met alle scholen
  erin (een vergeten schoolkolom in één query zou werk van school A aan school B laten zien). Een
  grote instelling die een eigen databaseserver wil, krijgt die als maatwerk, in deze volgorde:
  eerst Postgres (een tweede Drizzle-schema, migraties voor beide en de hele testsuite ook tegen
  Postgres; een paar weken werk), daarna MySQL/MariaDB, en SQL Server of Oracle alleen met een
  contract dat het betaalt (Drizzle ondersteunt die niet goed). Nu al: geen SQLite-specifieke SQL
  in de repositories. De pilot draait op twee databases, één voor de HSL en één voor de HHS, zodat
  het platform meteen werkt zoals het moet. Bastiaan, 2026-11-12 (thread "School, faculteit,
  opleiding en leerlijn beheren": "Maak wel het plan dat de database maatwerk wordt voor grote
  instellingen" en "Doe dan ook voor de pilot alvast twee databases").
- **BESLUIT-2026-11-12-4:** **Database per adres, binnen één app.** Eén container bedient alle
  instellingen; `TENANTS` noemt per instelling een id, haar adressen en haar SQLite-bestand. Elk
  verzoek draait op de instelling van zijn adres (een onbekend adres krijgt 404; alleen `/healthz`
  antwoordt overal en controleert elke database). Migraties, de dagelijkse back-up (in
  `backups/<id>/`), het opruimen van AI-gebruik, de modellenlijst van de beheerder en de lijst
  recente fouten gaan per instelling. Beheerscripts noemen de instelling met `LIMEONIT_TENANT`;
  bij meerdere instellingen zonder naam weigeren ze. Zonder `TENANTS` blijft alles één instelling op
  `DATABASE_URL`. De pilot begint vers: geen splitsscript. Een gebruiker die bij twee instellingen
  werkt, heeft voorlopig een account per instelling. De platformlaag (platformaccount, instellingen
  toevoegen, verwijderen, activeren en deactiveren in een scherm) is de volgende stap en vervangt
  `TENANTS`. Bastiaan, 2026-11-12 (thread "Pilot op twee databases (HSL en HHS)": "Doe dan ook voor
  de pilot alvast twee databases", "de data is nu nog niet belangrijk en kan helemaal vers worden
  neergezet", en over de platformlaag "Ja, omdat ik ook nieuwe instellingen wil kunnen toevoegen en
  verwijderen via die UI").
- **BESLUIT-2026-11-12-5:** **Platformlaag: het platform beheert de instellingen.** Met
  `PLATFORM_HOST` (bijvoorbeeld platform.limeonit.net) heeft het platform een eigen adres en een
  eigen database met het platformaccount van Bastiaan; geen beheerder van een instelling kan daarbij.
  De lijst instellingen staat in de datamap (`institutions.json`), buiten elke instellingsdatabase,
  wordt eenmalig overgenomen uit `TENANTS` en verandert zonder herstart. Toevoegen maakt de database,
  een eerste beheerder die ook eigenaar is en een link om een wachtwoord te kiezen. Deactiveren maakt
  de instelling direct onbereikbaar ("tijdelijk niet beschikbaar"), de data blijft. Verwijderen kan
  alleen bij een gedeactiveerde instelling, met het id ter bevestiging; database en back-ups gaan 60
  dagen naar het archief, waar ze terug te zetten zijn, en worden daarna gewist. Noodsleutel:
  `LIMEONIT_TENANT=platform npm run reset-2fa`. Het platform draait in een eigen container van
  dezelfde image (`LIMEONIT_SERVES=platform`), naast de schoolcontainer (`LIMEONIT_SERVES=institutions`),
  op dezelfde datamap; de schoolcontainer pikt wijzigingen zonder herstart op. Het scherm
  `/platform` is een eigen PR. Bastiaan,
  2026-11-12 (thread "Platformbeheer voor instellingen bouwen": "ik wil ook nieuwe instellingen
  kunnen toevoegen en verwijderen via die UI", "En (de)activeren.", over het archief "Misschien 60
  dagen vasthouden", het platformadres "limeonit.net of platform.limeonit.net", en in de thread
  "Platformscherm voor instellingen beheren" op de keuzekaart "Zelfde image, eigen container").
- **BESLUIT-2026-11-12-6:** **Een team hangt onder een opleiding, een onderdeel of niets.** Een
  gebruiker hoort bij een opleiding of onderdeel via zijn teams; er komt geen aparte koppeling van
  gebruiker aan opleiding. Een team van een opleiding hoort waar de opleiding hoort. Een team
  zonder opleiding (een examencommissie, een onderwijscommissie van een faculteit) zet de beheerder
  op de teampagina onder een onderdeel, of laat hem voor de hele instelling. Een onderdeel met een
  team eronder wordt niet verwijderd. Op de persoonspagina staat per team bij welke opleidingen en
  welk onderdeel het hoort. Een moduleteam is geen team maar de leden van een cursus
  (`course_members`); "heel team aan een cursus toevoegen" komt er pas als docenten erom vragen.
  Bastiaan, 2026-11-12 (thread "School, faculteit, opleiding en leerlijn beheren": "En het koppelen
  van een team aan een opleiding, "faculteit", of instelling, of niets, toch?" en over heel team
  toevoegen "Ja, maar alleen als dat het beheer vergemakkelijkt").
- **BESLUIT-2026-11-12-7:** **Bewijs in één keer: de AI stelt voor, de docent vinkt aan.** Op
  *Bewijs in één keer toevoegen* kiest de docent veel bestanden of een map. De bestanden worden in
  de browser gelezen en blijven daar; de namencheck draait per bestand voordat er tekst weggaat
  (de namen die de docent opgeeft, plus e-mailadressen, telefoonnummers en studentnummers). De AI
  stelt per bestand de leeruitkomst, de soort, de criteria en de regel uit het verplicht bewijs
  voor, en slaat niets op. De docent bevestigt alles in één lijst: niets wordt gekoppeld zonder
  vinkje, en twijfel (of een antwoord dat de code moest corrigeren, of een bestand zonder tekst)
  krijgt *Controleren*. Het voorstel schrijft geen tekst en komt daarom niet in de AI-verantwoording.
  Bastiaan, 2026-11-12 (thread "Waar kunnen we de cursussen en BDB/BKE nog beter maken", op het
  advies met punt 3: "Ik ga akkoord.").
- **BESLUIT-2026-11-12-8:** **Het doel: LimeOnIt draagt het onderwijswerk van een docent.** Niet
  "alle docenttaken overnemen", maar het werk rond ontwerpen, lesgeven, toetsen, nakijken,
  begeleiden, evalueren en professionaliseren. LimeOnIt doet het werk voor, de docent beslist en
  tekent; bij alles wat een student raakt (cijfer, oordeel, feedback) is het resultaat een concept
  (AI-verordening: beoordelen is hoog risico, BESLUIT-2026-07-03-4). Bewust buiten LimeOnIt:
  e-mail van studenten, vergaderverslagen, studenten met een functiebeperking en
  toetsvoorzieningen, fraude en plagiaat, roosteren en Osiris koppelen. Bastiaan, 2026-11-12
  (thread "Onderzoeken hulpjes voor docenttaken": "het onderwijswerk van een docent dragen - JA").
- **BESLUIT-2026-11-12-9:** **De toets van drie vragen voor elk nieuw hulpje.** (1) Kent LimeOnIt
  hier al iets van (een cursus, rubric, toets, dossier of opleiding)? (2) Wordt het onderwijs er
  beter van, niet alleen sneller? (3) Krijgt het resultaat een vaste plek in de app, met een
  volgende stap? Twee keer ja: het mag erin. Eén of geen keer ja: het blijft liggen. Een hulpje is
  bij voorkeur een knop op een plek die al bestaat (cursus, toets, rubric, dossier, traject) en
  geen nieuwe tool in het menu; Volgende stap laat het vinden. Bastiaan, 2026-11-12 (thread
  "Onderzoeken hulpjes voor docenttaken", op de uitleg van de toets: "Akkoord").
- **BESLUIT-2026-11-12-10:** **Zeven briefs voor de docenthulpjes (P33 t/m P39).** De hulpjes uit
  het onderzoek komen er, elk met een eigen brief: P33 cursusevaluatie verwerken, P34 kalibreren met
  een tweede beoordelaar, P35 het toetsdossier, P36 groepsfeedback na het nakijken, P37 lesbezoek
  met kijkwijzer, P38 het stage- en afstudeertraject naast OnStage (met feedforward op concepten en
  *Klaar voor OnStage*) en P39 de SLB-hulpjes. Volgorde en gedeelde bestanden staan in
  `docs/implementation/README.md` (*Docenthulpjes*). Ze vallen onder dit besluit buiten "tot de
  pilot geen nieuwe AI-tools" (BESLUIT-2026-11-05-4), in de volgorde van de README; P37 wacht op
  meekijken (P32.4) en P38 gaat pas aan voor docenten na het akkoord van BESLUIT-2026-11-12-11.
  Bastiaan, 2026-11-12 (thread "Onderzoeken hulpjes voor docenttaken": "De hulpjes die jij
  adviseert en powerpoint voor de pilot", en over de SLB-hulpjes: "Ja").
- **BESLUIT-2026-11-12-11:** **Het stage- en afstudeertraject: OnStage blijft officieel, LimeOnIt is
  de werkbank ernaast.** Per student een traject onder een code (geen naam), met mijlpalen van plan
  van aanpak tot *Klaar voor OnStage*: per formulierveld de tekst met een kopieerknop, de docent
  plakt en ondertekent in OnStage. Er is geen koppeling met OnStage (geen openbare API gevonden;
  OnStage is van Xebic, nu Paragin); een echte koppeling pas als Paragin die biedt en de hogeschool
  hem openzet. Nieuw is dat LimeOnIt studentwerk over weken bewaart: alleen de geanonimiseerde tekst
  en de feedback, nooit het origineel of een naam; de docent houdt de koppeling code–student zelf;
  nooit gedeeld, alleen een uitgenodigde tweede beoordelaar ziet het; bij afronden of na een korte
  bewaartermijn wordt het traject automatisch gewist. **Open punt voor de privacy-officer:** de
  bewaartermijn en een aanvulling op de DPIA. Tot dat akkoord staat het onderdeel *Stage- en
  afstudeertraject* uit voor iedereen (P28.3); bouwen mag wel. Bastiaan, 2026-11-12 (thread
  "Onderzoeken hulpjes voor docenttaken": "Ja dat is goed. We gebruiken OnStage, waar ik ook de
  documenten van studenten die ik begeleid kan inzien en waar de beoordeling uiteindelijk ingezet
  dient te worden").
- **BESLUIT-2026-11-12-12:** **SLB in de groep, niet per student.** LimeOnIt helpt bij
  studieloopbaanbegeleiding met SLB als cursus, formatieve feedback op reflecties en een POP (met
  een SLB-beoordelingsmodel, nooit een cijfer), een vragenset per gesprekssituatie (start,
  dreigend negatief BSA, uitval, keuze voor minor of stage; alleen de situatie, nooit de student),
  SLB-scenario's in *Lastig gesprek oefenen* en een wegwijzer naar het juiste loket (zonder AI, de
  beheerder vult de loketten in). Er komt **geen SLB-traject per student** met gespreksverslagen of
  studievoortgang: dat zou een tweede leerlingvolgsysteem met bijzondere persoonsgegevens naast
  Osiris worden. Bastiaan, 2026-11-12 (thread "Onderzoeken hulpjes voor docenttaken", op het
  SLB-advies: "Ja").
- **BESLUIT-2026-11-12-13:** **PowerPoint-export vóór de pilot.** P30.4 (een lesopzet als
  PowerPoint, met `pptxgenjs` uit BESLUIT-2026-11-06-4) mag nu, voor dia's bij een les. Dit vervangt
  het PowerPoint-deel van BESLUIT-2026-11-06-5; Excel, Brightspace en de huisstijl met eigen
  sjablonen blijven na de pilot. Bastiaan, 2026-11-12 (thread "Onderzoeken hulpjes voor
  docenttaken": "De hulpjes die jij adviseert en powerpoint voor de pilot").
- **BESLUIT-2026-11-12-14:** **Bij elke eval kiest Bastiaan: Claude Code of de API.** Een werker die
  een eval nodig heeft, geeft Bastiaan de keuze. Kiest hij Claude Code, dan draait de werker de eval
  zelf op zijn abonnement (`claude-code::claude-sonnet-5-5`, #314), met `--parallel` (#316), en zet
  het rapport in de PR. Kiest hij de API, dan draait Bastiaan hem zelf met zijn sleutel, en krijgt hij
  de stappen als één blok om te kopiëren. In de ijkmeting (`evals/reports/2026-11-12cc.md`) kwamen
  5 van de 7 cases gelijk uit met de API. Een voor- en nameting vergelijk je alleen als ze via
  dezelfde weg liepen. Bastiaan, 2026-11-12 (thread "Evals draaien via Codex of Claude Code": "Ja de
  keuze is aan mij"; "Geef ook bij volgende evals de keuze om het via claude code te doen of via de
  api").
- **BESLUIT-2026-11-12-15:** **Het stage- en afstudeertraject zit gewoon in de app.** Het onderdeel
  *Stage- en afstudeertrajecten* staat standaard **aan** en P38 wordt helemaal gebouwd (38.1 t/m
  38.8). Een beheerder kan het onderdeel op basis van de privacy-officer tijdelijk uitzetten
  (P28.3). Dit vervangt het deel van BESLUIT-2026-11-12-10 en -11 dat het onderdeel uit liet staan
  tot het akkoord; de bewaartermijn en de DPIA-aanvulling blijven een open punt voor de
  privacy-officer. Bastiaan, 2026-11-12 (thread "Bouw stagetrack naast OnStage": "Stage track wil
  ik gewoon hebben in de app. Een beheerder kan die op basis van de privacy officer nog tijdelijk op
  hidden zetten, maar ik wil de volledige feature in limeonit").
- **BESLUIT-2026-11-12-16:** **Het bord botst niet meer: één bestand per PR.** Een PR schrijft wat
  hij verandert in een eigen nieuw bestand `docs/fabriek/bord/<datum>-<onderwerp>.md` en raakt
  `STATUS.md` niet aan voor zijn eigen werk. Staat het bestand op `main`, dan is het gemerged; wat
  loopt, zijn de open PR's op GitHub. `STATUS.md` houdt alleen de verzoeken, wat op Bastiaan
  wacht, de volgorde, de open vragen en wat geparkeerd is. Dit vervangt de regel dat elke PR
  *Nu* en *Bezig* bijwerkt, en de regel dat de volgende PR die `main` binnenhaalt de vorige op het
  bord zet. Geen CI die naar `main` schrijft: `main` is beschermd en alleen Bastiaan merget.
  `tests/hotspots.test.ts` bewaakt het. Bastiaan, 2026-11-12 (thread "Voorkom merge-conflicten in
  het bord": "Kunnen we niets beters verzinnen voor het bord? Dit veroorzaakt ieder keer weer
  conflicts").
