# Fase 30 — Exporteren: Word, PDF, Excel, PowerPoint en Brightspace

> **Status:** ⚪ brief, nog niet bouwen. Volgens de afgesproken volgorde start de bouw na de pilot
> en de feedback daarop, tenzij Bastiaan anders zegt. Zo voer je deze brief uit: één deelstap per
> sessie, elke deelstap één PR vanaf `main`, test-first volgens `AGENTS.md` / de `/tdd`-skill, poort
> `npm test && npm run typecheck && npm run check`. Merge nooit zelf; alleen Bastiaan merget.

## In gewone taal

Een docent maakt in LimeOnIt een lesopzet, toetsvragen, een rubric of een toetsanalyse. Daarna moet
het ergens anders heen: naar Word om aan te passen, naar PDF om te delen, naar Excel om mee te
rekenen, naar PowerPoint om voor de klas te staan, of naar Brightspace waar de studenten zitten. Nu
kan alleen het BDB/BKE-dossier naar Word, en een cursus naar je agenda (`.ics`). De rest is
kopiëren en plakken.

P30 geeft **elk resultaat een knop "Exporteer"** met de formaten die bij dat resultaat passen:

- **Word en PDF** voor elk resultaat.
- **Excel** voor alles wat een tabel is: rubrics, de toetsmatrijs, de toetsanalyse, de cijfertabel.
- **PowerPoint** voor een lesopzet: een dia per fase, met sprekersnotities.
- **Brightspace**: toetsvragen als bestand dat de vragenbank van Brightspace inleest, en cijfers als
  bestand dat het cijferboek inleest.
- **Een voorbeeld vóór het downloaden**, in LimeOnIt zelf, zoals de viewer voor PDF en Word die er
  al is: dia's als dia's, een tabel als tabel.
- **De huisstijl van de hogeschool**: later kan een beheerder een eigen Word- en
  PowerPoint-sjabloon uploaden, en dan gebruikt elke export dat sjabloon.

**GradeWork** staat er bewust als onderzoek in, niet als bouwstap: er is geen openbaar
importformaat te vinden (zie 30.6). We bouwen het pas als we het echte formaat hebben.

## Wat er nu is (6 november 2026)

- `app/lib/portfolio/export.ts` (`buildDossierDocx`, dep `docx` 9.11) maakt het dossier als Word,
  met echte kopstijlen, tabellen met een herhaalde kopregel en de documenttaal. De markdown-lezer
  `app/lib/portfolio/markdown.ts` (`parseMarkdown` → `Block[]`: kop, alinea, lijst, tabel) zit erbij.
- `app/lib/utilities/rubric/export.ts` maakt een rubric als TSV en als markdown (kopiëren).
- `app/routes/courses.$id.calendar.tsx` geeft een cursus als `.ics`.
- `GradeCalculator` en de rubric hebben al `print:hidden` op de knoppen: printen naar PDF werkt
  daar half.
- Een resultaat van een tool is markdown per stap (`OutputFormat.kind`: `markdown` of
  `structured-sections`), bewaard als generatie (`generations.server.ts`).
- `ResultActions` staat onder elk resultaat (P27.1): volgende stap, bewaar bij cursus, gebruik als
  bewijs. Daar komt de exportknop bij.

## Vaste uitgangspunten

1. **Export is data, geen tak per tool.** Een stap van een tool zegt in het register wat zijn
   resultaat ís (`ToolStage.output.exportAs`), niet hoe het geëxporteerd wordt. Eén module
   `app/lib/export/` kiest de formaten bij die soort. Een `if (tool.id === …)` in de export is een
   fout. Validatie bij het opstarten (`registry/validate.ts`): een onbekende soort faalt.

   | Soort (`ExportKind`) | Formaten | Voorbeelden |
   | --- | --- | --- |
   | `document` (standaard) | Word, PDF | elk resultaat |
   | `table` | Word, PDF, Excel | toetsmatrijs, toetsanalyse, beoordelingsmodel |
   | `rubric` | Word, PDF, Excel | rubric (hulpmiddel en tool) |
   | `slides` | Word, PDF, PowerPoint | lesopzet |
   | `test-items` | Word, PDF, Brightspace-vragen | toetsvragen |

   Hulpmiddelen zonder AI (rubric, cijferrekenaar, toetsanalyse) gebruiken dezelfde module met hun
   eigen gegevens, niet via een generatie.

2. **Eén tussenvorm, vier schrijvers.** Alles gaat eerst naar een neutraal model
   (`ExportDoc`: titel, taal, blokken uit `parseMarkdown`, tabellen, dia's). Elke schrijver
   (`docx`, `xlsx`, `pptx`, `csv`) leest alleen dat model. De voorbeeldweergave leest hetzelfde
   model. Zo is wat je ziet wat je krijgt.
3. **Tellen in code, niet raden.** Tabellen, dia's en vragen worden in code uit het resultaat gelezen.
   Lukt dat niet zeker, dan exporteren we wat we wél zeker weten en zeggen we wat er niet mee kon. We
   vullen nooit iets aan dat het model niet schreef.
4. **Studentdata blijft in de browser** waar het kan (AGENTS.md). Cijfers voor Brightspace worden in
   de browser gemaakt; geen naam of studentnummer gaat naar de server. Werk van een tool met
   `handlesStudentWork` mag de eigenaar exporteren, nooit een teamlid (P28.4).
5. **Alleen de eigenaar** (of een teamlid met leesrecht, zoals `shares.server.ts` toestaat) krijgt
   een export; anders 404, zoals de dossier-export.
6. **Toegankelijk.** Word met echte kopstijlen en documenttaal (zoals nu); PDF via de print-weergave
   met dezelfde koppen; Excel met een kopregel en een vastgezette eerste rij; PowerPoint met een
   titel per dia (schermlezers lezen die als kop) en de leesvolgorde goed. De knop en de
   voorbeeldweergave hebben een axe-test.
7. **Veilig.** Bestandsnamen zoals `exportFileName` (ASCII-terugval plus RFC 5987). Een CSV-cel die
   met `=`, `+`, `-` of `@` begint krijgt een `'` ervoor (formule-injectie in Excel). Een geüpload
   sjabloon wordt aan de grens gecontroleerd (30.7).

## Nieuwe bibliotheken

Bastiaan keurde op 6 november 2026 twee nieuwe bibliotheken goed, voor Excel en voor PowerPoint
(BESLUIT-2026-11-06-3). De keuze:

| Formaat | Bibliotheek | Licentie | Waarom |
| --- | --- | --- | --- |
| Excel | `exceljs` | MIT | schrijft `.xlsx` met opmaak, vaste kopregel en kolombreedte; draait op de server. Het npm-pakket `xlsx` (SheetJS) is daar niet meer bijgewerkt. |
| PowerPoint | `pptxgenjs` | MIT | de gangbare bibliotheek voor `.pptx` in JavaScript; dia-masters, sprekersnotities, tabellen. |

Word blijft `docx` (er al), PDF heeft geen bibliotheek nodig (print-weergave), Brightspace is CSV
(geen bibliotheek). Controleer vóór 30.3 en 30.4 de laatste versie en `npm audit`; pin de versie
zoals `docx`.

**Niet goedgekeurd, apart vragen:** een derde bibliotheek om een geüpload PowerPoint-sjabloon te
vullen (zie 30.7).

## Deelstappen

### 30.1 — Het hart: `exportAs`, `ExportDoc` en Word voor elk resultaat

- **Register:** `OutputFormat.exportAs?: ExportKind` (standaard `document`). Zet de soort bij
  `test-items` (blueprint: `table`, items: `test-items`), `rubric-builder` (`rubric`),
  `lesson-plan` (`slides`), `test-analysis` (`table`), `stage-assessment` (`table`, het
  beoordelingsmodel). Validatie in `registry/validate.ts`.
- **Module `app/lib/export/`:**
  - `formats.ts`: `formatsFor(kind): ExportFormat[]`, puur.
  - `doc.ts`: `toExportDoc({ title, locale, sections })` met `parseMarkdown` (verhuist van
    `app/lib/portfolio/markdown.ts` naar `app/lib/export/markdown.ts`; het dossier importeert hem
    daar).
  - `docx.ts`: de markdown-naar-Word-code uit `buildDossierDocx` gaat hierheen (`blocksToDocx`);
    het dossier gebruikt hem. Geen tweede kopie.
- **Route:** `GET /work/:generationId/export.:format` als resource-route in een eigen
  `app/routing/export.ts`. Eigenaar of leesrecht in de repository, anders 404. Formaat onbekend of
  niet bij de soort → 404.
- **UI:** in `ResultActions` een knop "Exporteer" met een menu van de formaten van dit resultaat
  (een `<details>`-menu of een `<select>` + knop, met label). Bij een meerstapstool exporteert hij
  alle bewaarde stappen in één bestand, met per stap een kop.
- **i18n:** eigen namespace `export` (`app/lib/i18n/messages/{nl,en}/export.ts`).
- **RED:** `tests/export/formats.test.ts`, `tests/export/doc.test.ts` (koppen, tabellen, lijsten,
  lege stap), `tests/export/docx.test.ts` (het bestand opent, kopstijlen, taal), de dossier-tests
  blijven groen zonder aanpassing, `tests/registry/exportAs.test.ts` (validatie),
  `tests/routes/export.test.ts` (eigenaar 200, vreemde 404, teamlid bij `handlesStudentWork` 404),
  component-test met axe.

### 30.2 — PDF via de print-weergave

- Geen bibliotheek: een pagina `GET /work/:generationId/print` toont het `ExportDoc` met een
  print-stylesheet (`@media print`: geen menu, A4-marges, kopregels van tabellen herhalen,
  `break-inside: avoid` voor tabelrijen en dia's) en opent het printvenster van de browser. "Opslaan
  als PDF" doet de rest. De knop zegt dat ook ("Print of bewaar als PDF").
- Dezelfde stylesheet voor de cijferrekenaar en de rubric (die hebben al `print:hidden`).
- **Waarom geen echte PDF-bibliotheek:** de browser maakt een PDF met doorzoekbare tekst en de
  juiste lettertypen; een server-PDF vraagt een zware dependency (of een headless browser) voor
  hetzelfde. Als een hogeschool een PDF/UA-bestand eist, is dat een nieuwe vraag.
- **RED:** route-test (eigenaar, 404), component-test van de printpagina (koppen, tabel met
  `thead`, axe), een test dat de print-CSS de navigatie verbergt (`tests/print.test.ts`, de klassen).

### 30.3 — Excel voor tabellen (`exceljs`)

- `xlsx.ts`: `exportDocToXlsx(doc)`: elke tabel een werkblad (naam uit de kop ervoor, ingekort tot
  31 tekens en uniek), kopregel vet en vastgezet, kolombreedte naar inhoud. Getallen worden getallen
  (ook `3,5` in het Nederlands), de rest tekst. Geen tabel in het resultaat → geen Excel-knop.
- **Rubric:** één werkblad met criteria × niveaus en punten (uit `RubricData`, niet uit markdown).
- **Toetsanalyse (hulpmiddel):** de tabel per vraag (p-waarde, Rit/Rir) en de samenvatting.
  De scoretabel met studentnamen gaat **niet** mee naar de server: die export draait in de browser
  (`exceljs` werkt ook daar), of de namen gaan eruit. Kies in de PR, liefst de browser.
- **Cijferrekenaar:** de tabel punten → cijfer, met de cesuur.
- **RED:** `tests/export/xlsx.test.ts` (lees het bestand terug met `exceljs`: bladen, kopregel,
  getallen, formule-injectie geneutraliseerd), rubric- en cijfertabel-test.

### 30.4 — PowerPoint uit een lesopzet (`pptxgenjs`), met voorbeeld

- `slides.ts`, puur: `lessonToSlides(doc): SlideDeck` leest de lesopzet. Een titeldia (titel,
  leerdoel, succescriterium), een dia per fase uit het verloop (kop van de fase, de stappen als
  punten, de tijd erbij), een slotdia (terugkomen in volgende lessen). Tekst die niet op een dia
  past (meer dan zes punten) wordt een tweede dia, nooit kleiner gemaakt. De uitleg voor de docent
  gaat in de sprekersnotities, niet op de dia.
- Geen AI-stap erbij: de dia's komen uit wat het model al schreef. Blijkt in de pilot dat docenten
  echte inhoudsdia's willen (uitleg, voorbeelden), dan is dat een nieuwe AI-stap met een eigen
  meting, buiten P30.
- `pptx.ts`: `slideDeckToPptx(deck, theme)`: één eenvoudige master (titel, inhoud), titel als echte
  titel-placeholder. `theme` is voorlopig de standaard (LimeOnIt-kleuren, systeemlettertype); 30.7
  vult hem met de huisstijl.
- **Voorbeeld:** `SlidePreview`: dezelfde `SlideDeck` als HTML, een dia per kaart (16:9), vorige /
  volgende met het toetsenbord, "Dia 3 van 9" in `aria-live`. Geen viewer voor het `.pptx`-bestand
  zelf: het voorbeeld en het bestand komen uit hetzelfde model.
- **RED:** `tests/export/slides.test.ts` (fasen → dia's, te lange dia splitst, notities, lege
  lesopzet), `tests/export/pptx.test.ts` (het bestand is een geldige zip met het juiste aantal
  dia's), component-test voor `SlidePreview` met axe.

### 30.5 — Brightspace: toetsvragen en cijfers

**Wat vaststaat** (bronnen onderaan):

- **Vragen:** de vragenbank van Brightspace (*Question Library → Import → Upload a File*) leest een
  CSV met per vraag een blok regels: `NewQuestion,MC` (of `TF`, `MS`, `WR`, `SA`, `M`, `O`), dan
  `ID`, `Title`, `QuestionText`, `Points`, `Difficulty`, `Hint`, `Feedback`, en per type eigen
  regels: bij meerkeuze `Option,<percentage>,<tekst>,,<feedback>` (100 = goed, 0 = fout), bij open
  vragen `InitialText` en `AnswerKey`. Brightspace biedt zelf een sjabloon aan (*Download template
  CSV*). Het exacte sjabloon van de eigen omgeving is de toets voor deze stap.
- **Cijfers:** het cijferboek (*Grades → Import*) leest een CSV met `OrgDefinedId` of `Username`,
  per cijferonderdeel een kolom `<naam> Points Grade`, en als laatste kolom `End-of-Line Indicator`
  met `#` op elke regel. Komma als scheidingsteken (Excel in het Nederlands maakt `;`, dat leest
  Brightspace niet). Geen namen of e-mailadressen in het bestand.
- **Rubrics:** een losse CSV-import voor rubrics hebben we niet gevonden; een rubric gaat in
  Brightspace mee via een cursuspakket (*Import/Export/Copy Components*). **Niet bouwen** tot we
  een voorbeeldbestand hebben; tot dan is de Excel- en Word-export van 30.3 de weg.

**Bouwen:**

- **Vragen:** `brightspaceQuestions(items): { csv, skipped }`. Daarvoor moet het resultaat van
  *Toetsvragen* betrouwbaar per vraag leesbaar zijn: type, stam, opties, welke goed is, punten,
  feedback per afleider. Uit de huidige markdown (`test-items-items@v3`) lezen is broos. **Voorstel:**
  een `test-items-items@v4` die naast de leesbare tekst een vast, in code gecontroleerd blok per
  vraag schrijft (zoals `parseAgentReview` dat doet), met een meting zonder regressie op de
  bestaande checks (BESLUIT-2026-11-04-22). Een vraag die niet klopt (geen goed antwoord, twee goede
  bij `MC`) gaat niet mee en staat in `skipped`, met de reden in het scherm. Open vragen worden `WR`
  met het antwoordmodel als `AnswerKey`.
- **Cijfers:** in de browser, vanuit de toetsanalyse (de scoretabel staat daar al) en de
  cijferrekenaar: de docent plakt of kiest de cijferexport uit zijn eigen Brightspace (met
  `OrgDefinedId`), LimeOnIt vult de kolom `<naam> Points Grade` in op `OrgDefinedId` en geeft het
  bestand terug. Wie niet gekoppeld kon worden, staat in een lijst; er wordt niets geraden.
- **RED:** `tests/export/brightspace-questions.test.ts` (elk type, komma en aanhalingstekens in de
  tekst, HTML-vlag leeg, overgeslagen vragen met reden, formule-injectie), parse-test voor het blok
  uit `@v4`, `tests/export/brightspace-grades.test.ts` (koppelen op `OrgDefinedId`, onbekende
  regels, `End-of-Line Indicator`, komma's), component-test met axe. Eén handmatige import in een
  test-cursus van Brightspace hoort bij de acceptatie.

### 30.6 — GradeWork: eerst onderzoek, dan pas bouwen

**Wat we weten:** in de openbare handleidingen (Hogeschool Utrecht, Xebic-kennisplein) bouw je een
beoordelingsformulier in GradeWork zelf: criteria, punten, mogelijke waarden. GradeWork telt de
punten op maar rekent geen cijfer uit. Een openbaar importformaat voor formulieren of criteria
hebben we **niet gevonden**; het kennisplein van Xebic was niet bereikbaar. We verzinnen het niet.

**Doen:** vraag via de GradeWork-beheerder van de hogeschool (of Xebic-support) of formulieren te
importeren zijn en in welk formaat, met een voorbeeldbestand. Daarna een eigen korte brief of een
deelstap hier. Tot dan: rubric naar Excel en Word (30.3), zodat overtypen in GradeWork snel gaat.

### 30.7 — De huisstijl: eigen sjablonen voor Word en PowerPoint

In twee stappen, zodat de eerste geen nieuwe bibliotheek nodig heeft.

**a. Huisstijl als instellingen (geen nieuwe dependency).** Op `/admin/context` (of een tab
*Huisstijl*): logo (PNG/SVG, max 1 MB), twee kleuren en een lettertype uit een vaste lijst. Word
zet het logo in de koptekst en gebruikt de kleuren in de kopstijlen; PowerPoint (`pptxgenjs`) maakt
er de master van; de printpagina en het voorbeeld gebruiken dezelfde waarden. Opslag in
`instance_settings` (het logo als bestand in de datamap, niet in de database), geen migratie
als het past.

**b. Een echt sjabloonbestand.**
- **Word (.dotx/.docx):** `docx` kan de stijlen van een bestaand document overnemen
  (`externalStyles`, de `styles.xml` uit het sjabloon). Dan krijgt elke export de kopstijlen,
  lettertypen en kleuren van de hogeschool, zonder nieuwe bibliotheek. Kop- en voettekst uit het
  sjabloon zijn een stap verder; check in de PR wat `docx` daar kan.
- **PowerPoint (.potx/.pptx):** `pptxgenjs` kan geen bestaand bestand openen. Een sjabloon echt
  gebruiken (de dia-indelingen van de hogeschool vullen) vraagt een **derde bibliotheek**, zoals
  `pptx-automizer` (MIT, bouwt op `pptxgenjs`). **Dat vraagt eerst Bastiaans akkoord**
  (voorkeuren.md). Zonder die bibliotheek blijft 30.7a de huisstijl voor PowerPoint.
- **Upload aan de grens:** alleen een beheerder; Zod op het formulier; max 10 MB; het bestand moet
  een zip zijn met het juiste `[Content_Types].xml`; uitpakken met een grens op het totaal (geen
  zipbom); geen macro's (`.dotm`/`.potm` geweigerd). Eén sjabloon per soort per instelling; een
  nieuw sjabloon vervangt het oude, met een voorbeeld vooraf.
- **Per team?** Nee, voorlopig per instelling. Per team kan later in de lagen van P28.3.
- **RED:** schema-test van de upload (te groot, geen zip, macro, verkeerd type), test dat een
  export met sjabloon de stijlen van het sjabloon draagt, test dat zonder sjabloon alles werkt zoals
  voorheen, actietest alleen beheerder, axe op het beheerscherm.

### 30.8 — Documentatie (mee in de laatste PR)

Wiki (een pagina *Exporteren*: welke soort, welke formaten, hoe je een soort toevoegt), de
helpteksten voor docenten (Brightspace-import in drie stappen), `AGENTS.md` (één regel: export is
data via `exportAs`), `docs/implementation/README.md` en het bord.

## Volgorde en afhankelijkheden

| Stap | Wacht op | Tegelijk met |
| --- | --- | --- |
| 30.1 Hart en Word | — | 30.6 (onderzoek) |
| 30.2 PDF | 30.1 | 30.3 |
| 30.3 Excel | 30.1 | 30.2 |
| 30.4 PowerPoint en voorbeeld | 30.1 | 30.5 |
| 30.5 Brightspace | 30.1; vragen ook `test-items-items@v4` met meting | 30.4 |
| 30.6 GradeWork | antwoord van de GradeWork-beheerder of Xebic | alles |
| 30.7a Huisstijl als instellingen | 30.4 | — |
| 30.7b Eigen sjabloon | 30.7a; PowerPoint ook akkoord op een derde bibliotheek | — |

## Raakvlakken

- **P25.6 (dossier-export)**: de Word-code gaat naar `app/lib/export/` en het dossier gebruikt hem;
  het dossier krijgt er zo PDF bij.
- **P26.2**: `courseExport: "assessment-items"` blijft wat het is (naar de cursus); `exportAs` gaat
  naar buiten. Twee velden, twee doelen.
- **P27.1**: de exportknop staat in `ResultActions`, naast de volgende stap.
- **P28.4**: export volgt het leesrecht, en nooit studentwerk voor een teamlid.
- **P24.3**: een nieuwe `@v4` van de toetsvragen (30.5) houdt `@v3` geregistreerd.

## Buiten bereik

- Een export naar Google Docs/Slides/Sheets, Canvas, Moodle, TestVision, ANS of Remindo (kan later
  met dezelfde module; de import van TestVision/ANS/Remindo staat in BESLUIT-2026-11-04-16).
- Een koppeling met Brightspace via LTI of de API (automatisch heen en weer). P30 maakt bestanden.
- Een server-PDF of PDF/UA.
- Dia's met nieuwe inhoud door AI (zie 30.4).
- Een viewer die een willekeurig `.pptx`- of `.xlsx`-bestand opent; het voorbeeld toont alleen wat
  LimeOnIt zelf maakt.

## Acceptatie

`npm test && npm run typecheck && npm run check` groen na elke deelstap. Handmatig nalopen:

1. Onder een lesopzet: "Exporteer" → Word, PDF, PowerPoint. Het voorbeeld toont de dia's; het
   `.pptx`-bestand opent in PowerPoint met dezelfde dia's en de notities.
2. Onder een toetsmatrijs: Excel opent met één blad per tabel, de kopregel vast, getallen als
   getallen.
3. Een rubric uit het hulpmiddel gaat naar Excel en Word.
4. Toetsvragen gaan als CSV in de vragenbank van een Brightspace-testcursus; meerkeuze met het
   goede antwoord en feedback per afleider. Een vraag die niet klopt staat in de lijst "niet mee".
5. Cijfers uit de toetsanalyse gaan in het cijferboek van die testcursus; er ging geen naam naar
   de server.
6. Een tweede docent krijgt een 404 op de export van werk van een ander.
7. Na het uploaden van het Word-sjabloon van de hogeschool heeft een export de koppen en kleuren
   van dat sjabloon.

## Nog te beslissen door Bastiaan

1. **Toetsvragen naar Brightspace vraagt een nieuwe versie van de AI-tekst** (`test-items-items@v4`)
   die elke vraag ook in een vast formaat schrijft, met een meting. Akkoord, of eerst alleen Word,
   PDF en open vragen?
2. **Een derde bibliotheek voor PowerPoint-sjablonen** (`pptx-automizer`, MIT), of alleen logo,
   kleuren en lettertype (30.7a)?
3. **Wanneer bouwen:** na de pilot (de afgesproken volgorde), of 30.1 + 30.2 (Word en PDF voor
   alles, geen nieuwe dependency) al eerder?

## Bronnen

- Brightspace, vragen importeren: D2L Community, *Import questions into the Question Library*
  (https://community.d2l.com/brightspace/kb/articles/3411-import-questions-into-the-question-library);
  de regels per type zoals beschreven op https://jenniferlynnwagner.ielanguages.com/d2l-question-import.html.
- Brightspace, cijfers importeren: D2L Community, *Importing grades*
  (https://community.d2l.com/brightspace/kb/articles/5195-importing-grades).
- GradeWork: Hogeschool Utrecht, *Beroepsproducten in GradeWork* (PDF op husite.nl); het
  Xebic-kennisplein was op 6 november 2026 niet bereikbaar.
