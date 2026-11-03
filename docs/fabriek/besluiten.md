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
  **Wordt herzien in vereenvoudiging V2** (BESLUIT-2026-11-03-6).
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
- **BESLUIT-2026-11-03-7 (voorlopig):** **Modellen:** de beheerder stelt ze per instelling in en kan
  dat **per docent overrulen** (vervangen, dus ook ruimer dan de instelling). De
  cohortlaag verdwijnt met de studentenlaag.
- **BESLUIT-2026-11-03-8:** Het project wordt gestuurd als **softwarefabriek**: een Claude-project
  (het kantoor, threads = werkorders) en Claude Code (de werkplaats), met briefs als lopende band.
  Zie `docs/fabriek/`.
