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
  tools. Het menu blijft vier items (BESLUIT-2026-11-04-3). Brief P23.
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
