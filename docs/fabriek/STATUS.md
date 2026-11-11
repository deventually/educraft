# Fabrieksbord

> Het bord van de Producer. Een werker werkt het bij **in dezelfde PR** als zijn werk. Een lege sectie
> blijft leeg. Kort houden: dit is een bord, geen archief. Geschiedenis staat in `geschiedenis.md`,
> `docs/implementation/README.md` en git.

_Laatst bijgewerkt: 2026-11-11 (#187 t/m #285 gemerged)_

## Nu

- **Les voorbereiden: lesdoel en discipline vooraf ingevuld (#285) gemerged op 2026-11-11:**
  open je *Les voorbereiden* vanuit een les, dan staat het lesdoel van die les al ingevuld
  (zonder lesdoel de leeruitkomsten van de les). Heeft de les een discipline, dan noemt de
  lesinhoud die discipline en telt de voorkennis alleen eerdere lessen van dezelfde discipline.
  Nieuwe cursusbron `lessonGoal`; geen migratie.
- **BDB/BKE: verplicht bewijs als afvinklijst (#283) gemerged op 2026-11-11:** bovenaan het
  tabblad *Bewijs* staat wat het formulier als bewijs vraagt, per regel *Klaar*, *Controleren* of
  *Ontbreekt*. De docent koppelt een bewijsstuk, bevestigt een gok met *Ja, dit hoort erbij* of
  voegt nieuw bewijs toe. Feedback die een tool maakte is nooit een gok. De mijlpaal *Bewijs* en de
  check *Klaar om in te leveren?* tellen dezelfde regels.
- **BDB/BKE: hoofdstukopzet en literatuur uit het formulier (#284) gemerged op 2026-11-11:** de
  kaderextractie (`portfolio-framework@v2`) haalt per leeruitkomst ook de opzet van het hoofdstuk
  (secties, wat ze vragen, welke criteria ze dekken) en de literatuur uit het formulier. Het
  tabblad *Hoofdstuk* toont de opzet boven de editor. Een sectienaam die niet letterlijk in het
  formulier staat krijgt *Controleer*; een bron die er niet in staat valt weg. Eval:
  `npm run eval:framework`.
- **Cursuswizard, deel 2: het toetsprogramma (#280) gemerged op 2026-11-11:** heeft een cursus
  leeruitkomsten maar nog geen toetsen, dan staat bovenaan het Overzicht *Volgende stap: het
  toetsprogramma*. De AI stelt summatieve toetsen en formatieve oefenmomenten ervoor voor, met
  week, dekking, toetsvorm en een weging die zichtbaar een voorstel is. LimeOnIt past wegingen
  niet aan; tellen ze niet op tot 100% of zit een leeruitkomst in geen summatieve toets, dan staat
  dat erbij. Prompt `course-design-assessments@v1` met evals; geen migratie.
- **Controle: discipline die aan geen leeruitkomst bijdraagt (#281) gemerged op 2026-11-11:** de
  controle van een cursus meldt een discipline waarvan geen enkele les een leeruitkomst noemt,
  met de naam van de discipline; ook het reviewteam ziet het.
- **Per week filteren op discipline (#282) gemerged op 2026-11-11:** heeft een cursus
  disciplines, dan staat boven *Per week* een keuzelijst *Discipline*. Kies je er een, dan zie je
  alleen de lessen van die discipline, met alle toetsen erbij; weken die leeg raken vallen weg.
  Elke les toont ook zijn discipline.
- **Lesdoel op een les (#279) gemerged op 2026-11-11:** een les of opdracht heeft een optioneel
  *Lesdoel* van één zin: wat de student na deze les kan. Het staat in het formulier en onder de
  titel in *Lessen en toetsen*. Wizard deel 3 en *Les voorbereiden* bouwen erop; geen migratie.
- **BDB/BKE: tabbladen voor het dossier en per leeruitkomst (#278) gemerged op 2026-11-11:** het
  dossier heeft de tabbladen Overzicht en Afronden, elke leeruitkomst Overzicht, Bewijs, Hoofdstuk
  en Beoordelen (`?tab=` in de URL, zoals bij cursussen). Mijlpalen, *Los op*, de dossierreview en
  de export wijzen naar het goede tabblad. Eén gedeelde `TabNav`, ook voor de cursustabs.
- **Cursuswizard, deel 1: hoe je begint en de leeruitkomsten (#277) gemerged op 2026-11-11:** een lege cursus vraagt
  op het tabblad Overzicht *Hoe wil je beginnen?*: in grote lijnen ontwerpen, met een document,
  of leeg. Bij ontwerpen beschrijft de docent de cursus in een paar zinnen (plus EC en weken), en
  de AI stelt 3 tot 6 leeruitkomsten met Bloom-niveau en succescriteria voor, met de
  onderwijscontext en de disciplines erbij. De docent vinkt aan en past aan in hetzelfde
  formulier als bij importeren. Nieuwe prompt `course-design-outcomes@v1` met evals
  (`npm run eval:design`), schakelaar `courseDesign` voor de beheerder; geen migratie. Deel 2
  (het toetsprogramma) en deel 3 (lessen met lesdoel) volgen.
- **BDB/BKE: voortgang per leeruitkomst (#276) gemerged op 2026-11-11:** het overzicht van een
  dossier toont het gedeelde blok *Voortgang*: het kader, elke leeruitkomst apart en afronden,
  met één volgende stap. Op de pagina van een leeruitkomst staan vier mijlpalen (bewijs,
  hoofdstuk, feedback, getoond), elk een sprong naar dat deel. De coach is nooit verplicht: het
  eigen vinkje van de docent telt ook.
- **Voortgang van een cursus (#275) gemerged op 2026-11-11:** bovenaan het tabblad Overzicht een
  blok *Voortgang* met zes stappen van backwards design (cursusgegevens, leeruitkomsten, toetsen,
  lessen, weekplanning, controle), een balk, de *Volgende stap* met uitleg en een knop, en elke
  stap als link naar zijn tabblad. De cursuslijst toont per cursus de stappen en de volgende stap.
  `courseProgress` is puur; `ProgressPanel` (`app/components/progress/`) is gedeeld, ook voor de
  BDB/BKE.
- **Disciplines met uren per week (#274) gemerged op 2026-11-11:** een optioneel blok
  *Disciplines* op het tabblad Overzicht (naam, docent, uren per week) en een discipline per les.
  *Les voorbereiden* rekent de lesduur uit de uren van die discipline in die week, verdeeld over
  haar lessen in die week, afgerond op 5 minuten en nooit langer dan een lesmoment.
- **Import leest ook de modulegegevens (#273) gemerged op 2026-11-11:** *Importeren uit bestaande
  documenten* haalt uit een modulewijzer of modulehandleiding nu ook studiefase, moduleleider,
  examinatoren, de inhoudelijke beschrijving en de literatuur; alleen lege velden worden
  aangevuld. Nieuwe prompt `course-import@v3`. De vragenlijst onder een toets heet nu *Vragen (n)*.
- **Lesrooster van de cursus (#271) gemerged op 2026-11-11:** een blok *Lesrooster* op het
  tabblad Overzicht met weken, lesmomenten per week, duur van een lesmoment, groepsgrootte en
  contactvorm, allemaal optioneel (`set-schedule`, `CourseData.schedule`). *Les voorbereiden*
  neemt lesduur, groep en contactvorm daaruit over; geen migratie.
- **Vooraf invullen vanuit de les (#269) gemerged op 2026-11-11:** wie *Les voorbereiden* opent
  vanuit een les, krijgt de leeruitkomsten van die les, de lesinhoud (de titel) en de voorkennis
  (de vijf lessen ervoor) al ingevuld. Bronnen `itemTitle` en `earlierLessons` bij
  `prefillFromCourse`; geen per-tool code, geen migratie.
- **Cursuspagina in vijf tabbladen (#267) gemerged op 2026-11-11:** de lange cursuspagina is
  opgedeeld in *Overzicht*, *Leeruitkomsten*, *Lessen en toetsen*, *Controle* (met het aantal
  bevindingen) en *Documenten en delen* (met de modulewijzer en modulehandleiding). Het tabblad
  staat in de URL (`?tab=`), dus een formulier blijft op zijn tabblad en links vanuit Start en Per
  week openen het juiste tabblad.
- **Modulehandleiding uit de cursus (#272) gemerged op 2026-11-11:** naast de modulewijzer
  exporteert de cursus zonder AI een modulehandleiding: modulegegevens, inleiding, studielast en
  duur, leeruitkomsten met succescriteria, de opbouw per week, per toets de gegevens, voorwaarden
  en onderdelen, en de literatuur (nieuw modulegegeven, één per regel). Het blok heet nu
  *Modulewijzer en modulehandleiding*; geen migratie.
- **Terug en vooruit houden het resultaat van een tool vast (#270) gemerged op 2026-11-11:** wie
  vanuit een cursus een tool gebruikt en dan met de knoppen van de browser terug- of vooruitgaat,
  ziet het gegenereerde resultaat weer in plaats van een leeg formulier.
- **Modulewijzer uit de cursus (#266) gemerged op 2026-11-11:** een eigen blok *Modulewijzer* op
  de cursuspagina met modulecode, studiejaar, studiefase, moduleleider, examinator(en) en een
  inhoudelijke beschrijving (`set-module`; de instellingen dragen ze niet meer). Daaruit komt
  zonder AI een modulewijzer als Word, PDF of Markdown. Exportroutes
  `courses/:id/documents/:document`; geen migratie.
- **Browsertests voorlopig lokaal (#268) gemerged op 2026-11-11:** de GitHub-runner kon Chromium
  niet installeren (DNS). De `e2e`-job draait daarom alleen als de repositoryvariabele
  `E2E_IN_CI` op `true` staat; tot dan draait de werker `npm run test:e2e` zelf en zet de uitslag
  in de PR (BESLUIT-2026-11-11-9).
- **Mededelingen van beheer als banner (#265) gemerged op 2026-11-11:** beheer plaatst op
  */admin/announcements* een mededeling of waarschuwing voor iedereen, een team of één persoon, met
  een optionele laatste dag en eventueel terugkomen 1 tot 30 dagen na wegklikken. De banner staat
  boven de inhoud van elke pagina; wegklikken gaat via `/api/announcements/dismiss`.
- **Beginnen met een bestaande module (#264) gemerged op 2026-11-11:** de cursusimport
  (`course-import@v2`) leest nu ook wat een toetsmatrijs en nakijkmodel nodig hebben: modulecode,
  succescriteria, per toets vorm, cesuur, herkansing en onderdelen met weging, knock-out en
  criteria. Het is een voorstel dat de docent bevestigt; alleen lege velden worden aangevuld.
- **Maandlimieten in euro's (#260) gemerged op 2026-11-11:** de eigenaar zet een maandbudget voor
  de instelling, beheer een maandlimiet per team en per docent (een eigen limiet vervangt die van
  de teams). Vanaf 80% krijgt de docent één melding (een aandeel, nooit euro's), bij 100% weigert
  de AI tot volgende maand; beheerders zijn uitgezonderd. Het aantal aanroepen per dag is niet
  meer begrensd; een stille dagrem op output-tokens blijft (BESLUIT-2026-11-11-7 en -8).
- **Toetsmatrijs en nakijkmodel volgens de HSL-sjablonen (#263) gemerged op 2026-11-11:** het
  nakijkmodel heeft per onderdeel één tabel *Onderdeel | Onvoldoende | Voldoende*, met in de eerste kolom de naam, de
  leeruitkomsten, de weging en knock-out ja/nee, en elk criterium op een eigen regel. In de
  toetsmatrijs staat de cesuur ook in de totaalregel onderaan, zodat elke matrijs in een document
  zijn eigen cesuur draagt. Een tabelcel kan nu meer regels hebben (`<br>`) in Word, PDF en het
  voorbeeld. Alles blijft links uitgelijnd.
- **Weggaan terwijl de AI bezig is (#262) gemerged op 2026-11-11:** gaat een docent binnen de app
  naar een andere pagina terwijl een tool, chat of AI-formulier nog bezig is, dan vraagt een
  dialoog: laten doorlopen (het resultaat wordt bewaard), afbreken (de aanroep stopt, ook op de
  server via `/api/ai-cancel`) of op de pagina blijven (`AiLeaveGuard`).
- **Toetsmatrijs en nakijkmodel uit de cursus (#261) gemerged op 2026-11-11:** een toets met
  vragen exporteert zonder AI een toetsmatrijs (punten per leeruitkomst en niveau) als Word, PDF
  of Markdown. Een cursus legt nu optioneel vast wat toetsdocumenten van een school nodig hebben
  (modulecode, succescriteria, per toets vorm, cesuur, herkansing en onderdelen); daaruit komen
  een toetsmatrijs per leeruitkomst en een nakijkmodel per onderdeel.
- **AI-aanroep stopt ook bij sluiten of wegnavigeren (#259) gemerged op 2026-11-11:** sluit een
  docent een tool of chat, of gaat die binnen de app naar een andere pagina terwijl de AI nog
  schrijft, dan breekt de aanroep af (`useStreamAborts`) en kost hij geen tokens meer. De pagina
  *Gebruik* telt zo'n aanroep één keer, als mislukt.
- **Uitklapmenu's in de kop (#258) gemerged op 2026-11-11:** het accountmenu en het mobiele menu
  sluiten met Esc, met een klik ernaast of als Tab het menu verlaat; de pijltjestoetsen lopen
  rond, Home/End springen naar de uiteinden (`useDisclosure`). Menulinks tonen een focusring en
  de kop past op 320px (`e2e/reflow.spec.ts`).
- **Skill /accessibility-review (#257) gemerged op 2026-11-11:** loopt een scherm door zoals een
  toetsenbord- of schermlezergebruiker, omdat axe maar een deel vindt. Verplicht bij een PR die
  verandert wat een gebruiker ziet; `/security-review` bij een PR die repositories, auth, sessies
  of `/api` raakt; allebei in `/release`. BESLUIT-2026-11-11-7.
- **AI-gebruik 13 maanden per persoon bewaren (#256) gemerged op 2026-11-11:** regels in
  `ai_usage` ouder dan de dertien maanden die de pagina *Gebruik* toont, worden maandtotalen per
  tool en model zonder persoon (`ai_usage_rollup`, migratie 0031), voor de hele instelling en
  per team; de regels per persoon gaan weg. Een timer doet dit elk uur; een fout wordt gelogd en
  stopt de app niet. BESLUIT-2026-11-11-6.
- **Pagina Gebruik (#255) gemerged op 2026-11-11:** één pagina `/usage` voor iedereen, met per
  rol een andere kring (BESLUIT-2026-11-11-1). De docent ziet het eigen gebruik en wat er vandaag
  nog over is; een teamleider de teamtotalen, zonder namen en geld, en alleen het totaal bij
  minder dan drie actieve leden; beheer iedereen met de kosten; de eigenaar ook de maandprognose
  en wat caching bespaarde. Helponderwerp *Wat we meten*. Beheer → *Feedback en pilot* houdt
  alleen feedback en pilot.
- **Skills /release, /maintenance en /tdd (#254) gemerged op 2026-11-11:** `/release` maakt een
  release klaar (checklist, versienummer, notes in `RELEASE.md`, een PR; de tag zet Bastiaan),
  `/maintenance` doet de onderhoudsronde (Dependabot, `npm audit`, de toolchain), en `/tdd` is
  bijgewerkt.
- **Releases met een SemVer-tag (#253) gemerged op 2026-11-11:** een release is een tag `vX.Y.Z`
  op `main` die alleen Bastiaan zet. De tag bouwt de image op `ghcr.io/deventually/educraft:X.Y.Z`
  en een GitHub Release met de notes uit `RELEASE.md`. Op de VPS rolt `./deploy.sh X.Y.Z` uit
  (back-up, starten, wachten tot `/healthz` die versie meldt, terugrolcommando). De versie staat op
  *Gezondheid*. Nog geen release gedaan. BESLUIT-2026-11-11-5.
- **Prijzen per model (#252) gemerged op 2026-11-11:** elk model in `config/models.json` heeft
  de lijstprijs van de aanbieder per miljoen tokens, met de dag van opzoeken en de bronpagina, en
  een ECB-wisselkoers voor dollars. Beheer kan per model een eigen prijs zetten (een
  schoolcontract); die gaat voor. Elke aanroep krijgt de prijs van dat moment mee (migratie
  0030). De skill `/model-prices` houdt de lijstprijzen bij voor elke release.
  BESLUIT-2026-11-11-4.
- **Prompt caching (#250) gemerged op 2026-11-11:** elke aanbieder in `config/models.json` heeft
  een cachestrategie (`cache`). Bij Anthropic markeert LimeOnIt zelf wat bewaard wordt (de
  systeemprompt en de beurt voor de laatste). Bij OpenAI, Mistral en OpenRouter gaat er per gesprek
  een vaste sleutel mee. De andere aanbieders cachen vanzelf. Alleen chats; een losse aanroep niet.
  Herhaalde invoer wordt zo goedkoper; wat het scheelt, is te zien in `ai_usage` (cache lezen).
- **AI-gebruik meten (#251) gemerged op 2026-11-11:** elke AI-aanroep telt nu mee per gebruiker,
  dag, tool en model, in de nieuwe tabel `ai_usage` (migratie 0029): invoer, cache lezen, cache
  schrijven, uitvoer en denken, voor elke aanbieder gelijk getrokken. Chats en mislukte aanroepen
  tellen mee; alleen tellers, geen inhoud. De basis voor de pagina *Gebruik*.
  BESLUIT-2026-11-11-1 en -2.
- **Modelcatalogus: GLM, Grok, Qwen en Meta Muse (#249) gemerged op 2026-11-11:** een school kan
  ook Z.AI (GLM), xAI (Grok), Alibaba (Qwen, adres via `QWEN_BASE_URL`) of Meta Muse Spark Open
  via Together AI kiezen; alleen de sleutel in `.env` is nodig. BESLUIT-2026-11-11-3.
- **Brief P32 (#248) gemerged op 2026-11-10:** plan voor meekijken op uitnodiging en een reviewer
  Examencommissie, voor na de pilot.
- **Een cursus overdragen (#247) gemerged op 2026-11-10:** de eigenaar draagt een cursus over aan
  een teamgenoot of lid, de beheerder één of alle cursussen van een docent; bij het verwijderen
  van een account gaat een cursus met een mede-eigenaar eerst naar de eerste mede-eigenaar.
  BESLUIT-2026-11-10-5.
- **Mbo-vakgebiedpakketten per kwalificatie (#245) gemerged op 2026-11-10:** vier proefpakketten
  met de kerntaken en werkprocessen uit het SBB-kwalificatiedossier: Helpende Zorg en Welzijn,
  Verzorgende IG, Mbo-Verpleegkundige en Software developer. De mbo-keuzelijst groepeert nu per
  opleidingsdomein. Bij SBB nog navragen of we codes en titels mogen overnemen.
- **Installatiescripts en audit (#246) gemerged op 2026-11-10:** `allowScripts` in package.json
  laat alleen better-sqlite3 en esbuild hun installatiescript draaien (npm 11); `npm audit` is
  schoon.
- **Leerlijnen (#244) gemerged op 2026-11-10:** een leerlijn is een benoemde, geordende reeks
  cursussen binnen een opleiding. De teamleider of een beheerder maakt hem aan; elk teamlid leest
  hem. Het overzicht laat per cursus zien welke leeruitkomsten terugkomen, met het hoogste
  Bloom-niveau, en waar dat niveau zakt. Geen AI. Pagina `/programmes/:id/lines/:lineId`;
  migratie 0028.
- **Samen aan een cursus werken (#243) gemerged op 2026-11-10:** een cursus heeft één eigenaar en
  daarnaast mede-eigenaars en bewerkers, gekozen uit collega's met wie je een team deelt. Een
  bewerker wijzigt de inhoud en laat het reviewteam kijken; een mede-eigenaar mag de cursus ook
  delen en kiezen wie meewerkt. Alleen de eigenaar verwijdert de cursus en draagt hem over aan een
  collega (BESLUIT-2026-11-10-5). Migratie 0027.
- **Vakgebiedlijsten voor mbo en wo (#242) gemerged op 2026-11-10:** bij mbo kies je een
  opleidingsdomein uit de 18 domeinen, bij wo een van de tien CROHO-onderdelen. Wo krijgt een
  sectorpakket met de Dublin-descriptoren, en de reviewer Werkveld (`@v2`) werkt nu voor elke
  sector, ook zonder beheersingsniveau. De mbo-proefpakketten uit de kwalificatiedossiers volgen in
  een tweede PR; bij SBB nog navragen of we codes en titels mogen overnemen. BESLUIT-2026-11-10-4.
- **Opleidingen van een team (#241) gemerged op 2026-11-10:** een opleiding bundelt de cursussen
  van een team, met per cursus jaar en periode (BESLUIT-2026-11-10-3). De teamleider of een
  beheerder maakt hem aan; elk teamlid leest hem. Een eigen cursus in een opleiding zetten deelt
  hem met het team; een cursus kan in meer opleidingen staan. Pagina's `/programmes` en
  `/programmes/:id`, "Hoort bij opleiding" op de cursuspagina, helponderwerp *programmes*;
  migratie 0026.
- **Reviewer Inclusie (#239) gemerged op 2026-11-10:** een zesde reviewer kijkt naar de cursus
  vanuit Universal Design for Learning: kunnen studenten op meer dan één manier leren en laten
  zien wat ze kunnen (afwisseling in toetsvormen en werkvormen, niet alles op één moment in één
  vorm, een kleine keuze), steeds met een haalbaar alternatief. Voor docenten standaard uit; eigen
  stuk op `/help/review-team`; drie eval-cases. De reviewer Student is naar `agent-student@v2`
  gegaan: die waarschuwt alleen nog bij een echte botsing.
- **Figuren: grafieken en diagrammen uit een PDF (#240) gemerged op 2026-11-10:** bij
  *Studentwerk beoordelen* vindt LimeOnIt in een PDF ook getekende grafieken, diagrammen en
  stroomschema's als figuur, met hun labels; tabellen, kaders, lijnen en herhaalde logo's niet.
  Bij Word worden grafieken en SmartArt geteld, met de tip het verslag als PDF te uploaden.
- **Reviewer Student (#238) gemerged op 2026-11-10:** een vijfde reviewer loopt de cursus week
  voor week door zoals een student: deadlines die samenvallen, feedback die pas komt als het al
  telt, lege weken met een eindsprint. Voor docenten standaard uit; eigen stuk op
  `/help/review-team`. `npm run eval:agents -- --agent <id>` draait de cases van één reviewer.
  Eval 9/9 (`evals/reports/2026-11-10b-role-agents.md`). PR 5 van het plan "Nieuwe rolagenten
  en examencommissie".
- **Reviewer Werkveld (#237) gemerged op 2026-11-10:** een vierde reviewer kijkt of studenten
  oefenen en getoetst worden zoals in het beroep, op het niveau van de beroepsactiviteiten en het
  beheersingsniveau uit het vakgebiedpakket. Voor docenten standaard uit; eigen stuk op
  `/help/review-team`. Eval rolagenten 51/51 (`evals/reports/2026-11-10-role-agents.md`). PR 4
  van het plan "Nieuwe rolagenten en examencommissie".
- **Beoordelingsmodellen per documenttype (#236) gemerged op 2026-11-10:** op de nieuwe pagina
  `/assessment-models` legt een docent eigen modellen vast: per documenttype een kader en een
  optionele schaal, zelf geschreven of gekopieerd uit een startmodel (HBO-i-stage,
  afstudeerscriptie, onderzoeks- of ander verslag, essay). Bij *Stagebeoordeling* vult het eigen
  model zich vanzelf in; zonder schaal geeft de tool alleen feedback, zonder oordeel
  (`stage-assessment@v3`). Migratie (`npm run db:migrate`).
- **Reviewer AI-bestendigheid (#235) gemerged op 2026-11-10:** het reviewteam heeft een derde
  reviewer die kijkt of het cijfer laat zien wat de student zelf kan, nu AI een verslag of code
  kan schrijven. Hij gebruikt *onder toezicht / zonder toezicht* uit #233, verbiedt AI niet en
  raadt geen detectors aan. Voor docenten staat hij standaard uit. Geen migratie.
- **Help-sectie opnieuw ingedeeld (#234) gemerged op 2026-11-10:** `/help` groepeert de
  onderwerpen naar wat een docent wil doen, toont tools per onderwijsdoel en heeft een zoekvak dat
  ook koppen vindt. Nieuwe onderwerpen (werken met een tool, eerder werk en export, hulpmiddelen,
  teams en delen, en een beheerdersonderwerp), en onder zes schermen een rustige *Hoe werkt
  dit?*-link. De handleiding BDB/BKE ziet alleen wie de werkplek heeft.
- **Een toets onder toezicht markeren (#233) gemerged op 2026-11-10:** bij een toets in de
  cursus kies je *onder toezicht*, *zonder toezicht* of niets. Het staat in de regel onder de
  toets en het reviewteam weegt het mee. Geen migratie.
- **Figuren voor de beoordeling (#232) gemerged op 2026-11-10:** bij *Studentwerk beoordelen*
  knipt LimeOnIt echte figuren uit de PDF (geen hele pagina's, geen logo's of scans), een klik
  vergroot een plaatje, en de namen overlappen niet meer. Het veld *Kernfiguren* heet nu
  *Figuren voor de beoordeling*; een eigen upload is de reserve.
- **Onderhoud zonder gedragswijziging (#222 t/m #230) gemerged op 2026-11-10:** Node 26 (LTS)
  via Volta overal (#229); Dependabot-updates voor de GitHub Actions checkout, setup-node,
  upload-artifact en CodeQL (#222–#225), unpdf 2.1 (#228) en oxc-parser (#226); de test van de
  mutatie-workflow accepteert elke versie van upload-artifact (#230).
- **Reviewteam: de docent kiest zelf welke reviewers meekijken (#231) gemerged op 2026-11-10:**
  wat eerst "rolagenten" en "petten" heette, heet voor docenten nu het *Reviewteam* met
  *reviewers* (BESLUIT-2026-11-10-2). Boven *Laat reviewen* vinkt de docent aan wie er in het
  team zit; de keuze geldt voor al zijn of haar cursussen, en wat de beheerder uitzet blijft uit.
  Nieuwe reviewers staan voor een docent standaard uit (BESLUIT-2026-11-10-1). Helppagina
  `/help/review-team` met een stuk per reviewer. Migratie 0024 (`npm run db:migrate`). PR 1 van
  het plan "Nieuwe rolagenten en examencommissie"; de Examencommissie komt pas na de pilot of bij een tweede pilot.
- **Overdrachtsdocument en noodplan (#221) gemerged op 2026-11-10:** `docs/overdracht.md` zegt
  wat een vervanger moet weten (geheimen alleen bij naam, deployen, terugrollen, back-up, de
  ops-scripts); `docs/noodplan.md` wat te doen bij storing, dataverlies, een datalek of een
  kwijte server. Een test houdt beide bij de code. Open vragen voor Bastiaan staan erin als lijst.
- **Twee a11y-lintregels weer aan en een beveiligingsscan in CI (#220) gemerged op 2026-11-10:**
  knoppen hebben een `type`, labels wijzen naar hun veld. CI draait `npm audit` en CodeQL;
  Dependabot stelt wekelijks updates voor. Geen gedragswijziging.
- **Routetests loggen echt in (#219) gemerged op 2026-11-10:** `signInAs` / `signedRequest`
  (`tests/helpers/session.ts`) vervangen de mock van `auth.server`, zodat de tests de echte
  toegangscontrole raken. Geen gedragswijziging.
- **Anthropic-SDK 1.x (#218) gemerged op 2026-11-10:** de SDK achter de prompt-evals gaat naar
  versie 1. Geen gedragswijziging in de app.
- **better-sqlite3 13 (#217) gemerged op 2026-11-10:** de databasedriver levert de binaries voor
  Alpine (musl, x64 en arm64) nu zelf mee in het npm-pakket; een test borgt dat de Docker-image
  geen compiler nodig heeft. Geen gedragswijziging.
- **Testsuite bijna twee keer zo snel (#216) gemerged op 2026-11-10:** de meeste testbestanden
  delen hun modules per worker (`isolate: false`, elk met een eigen in-memory database); een
  bestand dat `vi.mock` gebruikt of `process.env` zet, draait apart (`tests/helpers/isolation.ts`).
  Geen gedragswijziging.
- **Kleine dependency-updates (#215) gemerged op 2026-11-10:** react-markdown 10, lucide-react 1,
  docx en Playwright naar hun nieuwste versie. Geen gedragswijziging.
- **@testing-library/jest-dom 7 (#214) gemerged op 2026-11-10:** alleen een testhulpje; geen
  gedragswijziging.
- **@types/node 24 (#213) gemerged op 2026-11-10:** de Node-types passen nu bij de Node-versie die
  we draaien (24); een test houdt die twee gelijk. Geen gedragswijziging.
- **Stryker draait weer onder TypeScript 7 (#212) gemerged op 2026-11-10:** Stryker wilde de
  tsconfig herschrijven via de JS-API die TypeScript 7 niet meer heeft; `stryker.config.json` wijst
  nu naar een tsconfig die niet bestaat, zodat die stap overgeslagen wordt. De 5 moderate
  audit-meldingen zitten in Stryker zelf en wachten op een nieuwe Stryker-versie.
- **TypeScript 7 (#211) gemerged op 2026-11-10:** de derde versiesprong uit #189; `npm run typecheck`
  duurt nu een paar seconden. TypeScript 7 heeft geen JS-API meer, dus de importscanner in
  `tests/architecture.test.ts` gebruikt `oxc-parser`. Geen gedragswijziging.
- **Biome 2.6 (#210) gemerged op 2026-11-10:** de tweede versiesprong uit #189. Markdown (de
  prompts met de tekst van het boek en de helppagina's) blijft buiten Biome; de nieuwe regel
  `noComponentHookFactories` staat alleen in `tests/` uit, voor route-stubs. Geen gedragswijziging.
- **Vitest 5 (#208) gemerged op 2026-11-10:** de testomgeving gaat van vitest 4 naar 5, de eerste
  van drie grote versiesprongen uit #189. `tests/jest-dom.d.ts` koppelt de jest-dom-controles aan
  het nieuwe matcher-type van vitest 5. Geen gedragswijziging.
- **Leerdoelen en trefwoorden uit de mutatiemeting (#209) gemerged op 2026-11-10:**
  `registry/goals.ts` en `registry/keywords.ts` zijn pure data, net als `tools/`, en tellen niet
  meer mee in Stryker. Dat scheelde 392 nepmeldingen: de eerste run op main ging van 63,8% naar
  75,9%. Geen gedragswijziging.
- **Tweestapsverificatie met een authenticator-app (#207) gemerged op 2026-11-10:** beheerders en
  de eigenaar moeten een code uit een authenticator-app invoeren, anders gaan de beheerpagina's
  niet open; voor docenten is het optioneel (`/account/2fa`). Iedereen krijgt 10 herstelcodes. Alles
  kwijt: de eigenaar zet het uit op de pagina van die persoon, en zichzelf met `reset-2fa`. Met
  migratie (`0023`); BESLUIT-2026-11-09-3.
- **Mutatietesten met Stryker (#206) gemerged op 2026-11-09:** Stryker verandert expres kleine
  stukjes in de kern (registry, inloggen, repositories, de slotjes tegen raden) en kijkt of de tests
  dat merken. Draait 's nachts en met de hand (`npm run test:mutation`), nooit op een PR; het
  rapport blijft bewaard in CI. Geen gedragswijziging.
- **DynamicForm, AppShell en leerdoelen-register opgesplitst (#205) gemerged op 2026-11-09:**
  `DynamicForm.tsx`, `AppShell.tsx` en `registry/goals.ts` zijn verdeeld over kleinere onderdelen
  (`form/`, `shell/`, `registry/keywords.ts`); de ratchet-lijst van lange bestanden is nu leeg. Geen
  gedragswijziging.
- **Gebruikers-, modellen-, beschikbaarheids- en Start-code opgesplitst (#204) gemerged op
  2026-11-09:** `users.server.ts` (599 → 200 regels), `models.ts` (475 → 311),
  `availability.server.ts` (405 → 198) en `start.tsx` (402 → 173) zijn verdeeld over kleinere
  modules; de oude bestanden exporteren ze opnieuw. Alle vier zijn van de ratchet-lijst af. Geen
  gedragswijziging.
- **Rubric-editor en -invullen opgesplitst (#203) gemerged op 2026-11-09:** `RubricEditor.tsx` en
  `RubricFill.tsx` (nu 197 en 202 regels) zijn verdeeld over `RubricCriterionEditor`, `RubricControls`,
  `RubricGradeSettings`, `RubricTable`, `RubricStudentForm`, `RubricStudentTable` en
  `rubricFillText`; beide bestanden zijn van de ratchet-lijst af. Geen gedragswijziging.
- **Portfoliopagina's opgesplitst (#202) gemerged op 2026-11-09:** `portfolio.$id.tsx` (458 → 349
  regels) en `portfolio.$id.outcome.$outcomeId.tsx` (507 → 327) delen nu de onderdelen
  `DossierExport` en `EvidenceRow`; beide routes zijn van de ratchet-lijst af. Geen
  gedragswijziging.
- **Documentviewer opgesplitst (#201) gemerged op 2026-11-09:** `DocumentViewer.tsx` (662 → 367
  regels) is verdeeld over `PdfPages`, `ViewerControls`, `AiTextPanel` en `highlightWords`; het
  bestand is van de ratchet-lijst af. Geen gedragswijziging.
- **Contextvelden en vakgebiedpakketten opgesplitst (#200) gemerged op 2026-11-09:**
  `ContextFields.tsx` (636 → 380 regels) is verdeeld over `DomainFields`, `CustomFieldsEditor` en
  `Field`; `packs.ts` (538 → 110) over `packsCareSociety` en `packsTechBusiness`. Beide bestanden
  zijn van de ratchet-lijst af. Geen gedragswijziging.
- **ChatView opgesplitst (#199) gemerged op 2026-11-09:** `ChatView.tsx` (648 → 253 regels) is
  verdeeld over de hook `useChatSession` en de onderdelen `ChatSetupCard`, `ChatSettingsAside`,
  `ChatThread` en `ChatComposer`; het bestand is van de ratchet-lijst af. Geen gedragswijziging.
- **Beheerpagina Modellen opgesplitst (#198) gemerged op 2026-11-09:** `admin/models.tsx` (760 → 249
  regels) is verdeeld over `AddModelForm`, `ProvidersTab` en `modelShared`; het bestand
  is van de ratchet-lijst af. Geen gedragswijziging.
- **Eén strategie per tool-modus (#196) gemerged op 2026-11-09:** wat verschilt tussen een chat,
  een tool met stappen en een losse generatie staat nu op één plek (`modeOf(tool)` in
  `app/lib/registry/modes.ts`) in plaats van in losse `tool.mode`-takken. `tool.tsx` (514 → 238)
  en `api.stream.tsx` (412 → 400) zakken onder de 400 regels; een architectuurtest weigert een
  nieuwe tak op `tool.mode`. Voor docenten verandert er niets.
- **Browsertests met Playwright (#197) gemerged op 2026-11-09:** `npm run test:e2e` bouwt de app
  en opent de belangrijkste pagina's als gast, docent en beheerder; elke pagina moet laden, zonder
  axe-fouten (WCAG 2.2 AA) en zonder CSP-fout. Draait in CI als eigen job. Onderweg verbeterd: de
  tegels op de toolpagina heten nu naar hun zichtbare tekst, de inlogpagina heeft een `main` en de
  licentielink is onderstreept.
- **Beheerpagina's voor gebruikers opgesplitst (#195) gemerged op 2026-11-09:**
  `admin.users.tsx` (792) en `admin.users.$id.tsx` (622) zijn verdeeld over losse componenten en
  twee servermodules; allebei onder de 400 regels. Geen gedragswijziging.
- **knip in de poort (#194) gemerged op 2026-11-09:** `npm run check` draait nu ook knip, dat
  ongebruikte bestanden, exports en dependencies meldt. 68 exports die alleen hun eigen bestand
  gebruikte zijn niet meer geëxporteerd, en vier ongebruikte waarden zijn weg.
- **Golf 1 van het P2-plan (#188 t/m #193) gemerged op 2026-11-09:**
  - **Dependencies bijgewerkt (#189):** `ai`, `@ai-sdk/*` en de rest naar hun nieuwste versie
    binnen dezelfde major. Biome blijft op 2.4.16 (2.5 herformatteert ~200 bestanden, apart).
  - **Index op `generations` (#188):** migratie 0022 voegt een index op (gebruiker, aanmaakdatum)
    toe; de geschiedenis hoeft niet meer de hele tabel door te lezen.
  - **De `pXX-removed`-tests opgeruimd (#190):** hun twee blijvende regels zijn nu gedrag:
    elke beheerpagina wordt vanzelf op toegang getest, en `invite` weigert `--role admin`.
  - **Wachtwoordcheck tegen een lijst (#191):** een nieuw wachtwoord heeft minstens 10 tekens en
    staat niet op een lijst van veelgebruikte wachtwoorden (NCSC plus Nederlandse favorieten).
    Geldt voor uitnodiging, reset, `/account`, beheer en `create-admin`. Geen externe dienst.
  - **CSP met nonces (#192):** scripts draaien alleen nog met een nonce per verzoek, zonder
    `'unsafe-inline'`. Zod draait "jitless", zodat de browser geen CSP-fout meer meldt.
  - **Snellere testsuite (#193):** de node-tests laden geen DOM-setup meer; de opstarttijd zakt
    van ~48 s naar ~10 s.
- **Strengere TypeScript, fase 2 (#187) gemerged op 2026-11-09:** `noUncheckedIndexedAccess`
  staat aan; de ~950 meldingen zijn opgelost met guards en defaults, zonder iets weg te
  asserten in `app/`.
- **Fouten vastleggen in de app (P1 middelgroot uit de doorlichting, #186) gemerged op
  2026-11-09:** elk verzoek krijgt een request-id (header `X-Request-Id`); onverwachte fouten gaan
  als één JSON-regel met dat id naar de log, en de eigenaar ziet de laatste 50 op
  `/admin/errors` (*Recente fouten*). Alleen metadata, nooit een body. De foutpagina noemt de
  docent het precieze tijdstip en de pagina om te melden.
- **Audit-log van beheeracties (P1 middelgroot uit de doorlichting, #185) gemerged op 2026-11-09:**
  rol, wachtwoord, deactivering, uitnodiging en modelkeuze komen in een log op `/admin/audit`.
  Regels ouder dan een jaar verdwijnen vanzelf; de eigenaar kan met een bevestiging eerder opruimen.
- **Strengere TypeScript, fase 1 (P1 middelgroot, #184) gemerged op 2026-11-09:**
  `noUnusedLocals` en `noFallthroughCasesInSwitch` staan aan en een test houdt ze aan. Fase 2
  (`noUncheckedIndexedAccess`) volgt.
- **Sessie verloopt na 8 uur inactiviteit, plus "Overal uitloggen" (P1-4, #182) gemerged op
  2026-11-09:** elk verzoek telt als activiteit (root-middleware); op de accountpagina log je alle
  andere apparaten uit.
- **Architectuurregels als test (P1-punt 6 uit de doorlichting, #181) gemerged op 2026-11-09:**
  `tests/architecture.test.ts` bewaakt dat `app/components` niets uit een `*.server`-module
  binnenhaalt, dat alleen `db.server.ts` `better-sqlite3` gebruikt en dat buiten `app/lib/ai/`
  niets een AI-SDK importeert. AGENTS.md noemt de test.
- **Ratchet-tests (P1-punt 7 uit de doorlichting, #179) gemerged op 2026-11-09:**
  `tests/ratchet.test.ts` legt de tellingen van vandaag vast: 31 onderdrukkingen (`as any`,
  `@ts-ignore`, `@ts-expect-error`, `biome-ignore`) en 20 bestanden in `app/` boven 400 regels
  mogen alleen dalen, en een TODO of FIXME mag alleen met een issuenummer.
- **Beter contrast voor grijze tekst (P1-punt 3 uit de doorlichting, #178) gemerged op 2026-11-09:**
  `slate-500` is donkerder (#676d5d, minstens 4,5:1) en alle niet-decoratieve `slate-400`
  (tekst, placeholders, verwijderknoppen) is `slate-500` geworden. `tests/contrast.test.ts`
  bewaakt dat `slate-400` alleen nog op `aria-hidden` staat.
- **Gezondheid op de beheerpagina (P1-punt 5 uit de doorlichting, #183) gemerged op 2026-11-09:**
  elke beheerpagina toont de leeftijd van de laatste back-up (waarschuwing na 36 uur of zonder
  back-up), de grootte van de database en de vrije schijfruimte. Alleen lezen.
- **Fonts zelf hosten (P1-punt 1 uit de doorlichting, #180) gemerged op 2026-11-09:** Inter en
  Newsreader staan als woff2 in `public/fonts/` (met OFL-licentie); geen verzoeken meer naar
  Google, en de CSP staat voor stijlen en fonts alleen nog `'self'` toe.
- **safeRedirect dichtgezet (P1-punt 2 uit de doorlichting, #177) gemerged op 2026-11-09:**
  `app/lib/safeRedirect.ts` weigert `/\evil.com`, backslashes, besturingstekens en alles wat naar
  een andere origin leidt.
- **Lange AI-antwoorden blijven doorlopen (P0-punt 3 uit de doorlichting, #175) gemerged op 2026-11-09:**
  de stream stuurt elke 15 seconden een keep-alive, zodat een proxy zoals Cloudflare (100 s
  zonder verkeer) een lang antwoord niet afbreekt voor het eerste woord. Sluit de docent het
  tabblad, dan stopt de modelaanroep ook (AI SDK, Ollama en CLI); een afgebroken stream bewaart
  niets en logt `aborted`.
- **Ingebouwde back-up zonder stilstand (P0-punt 2 uit de doorlichting, #176) gemerged op 2026-11-09:** de app maakt
  zelf elke dag een back-up van de database terwijl hij doorloopt (SQLite online backup), naar
  `backups/` naast de database (`/data/backups` in Docker, of `BACKUP_DIR`), met rotatie (7 dagen,
  4 weken). `npm run backup` / `node build/ops/backup.js` maakt er nu een; `restore` zet er een
  terug na een controle en bewaart de oude database. Van de server af kopiëren blijft handwerk.
  Geen migratie, geen nieuwe dependency.
- **Inloggen beveiligen tegen wachtwoorden raden (P0-punt 1 uit de doorlichting, #174, BESLUIT-2026-11-09-1) gemerged op 2026-11-09:** na 5 foute
  wachtwoorden voor één e-mailadres is dat adres 15 minuten op slot, ook met het goede wachtwoord en
  ook voor een adres dat niet bestaat (zo verraadt het slot niets). Elk volgend slot duurt twee
  keer zo lang (15 min, 30 min, 1 uur … tot 24 uur); een goede login of een dag zonder fouten zet
  het terug. Nooit automatisch deactiveren, want dan kan iedereen een collega buitensluiten. Met `CLIENT_IP_HEADER` (de header die de reverse proxy zet) geldt daarnaast 30 fouten per
  IP-adres. In het geheugen van de app, geen externe dienst; een herstart wist de tellers.
  Wachtwoorden hashen loopt nu async (scrypt blokkeert andere verzoeken niet meer). Geen migratie.
- **Security-headers op elke response (P0-punt 4 uit de doorlichting, #173) gemerged op 2026-11-09:** ook `/api/*`,
  exports, prints, `/healthz` en redirects krijgen nu CSP, `nosniff`, `X-Frame-Options` en
  `Referrer-Policy`, via middleware op de root-route. De CSP kreeg er `frame-ancestors 'none'`,
  `base-uri`, `form-action` en `object-src` bij; HSTS alleen in productie.
- **Terughalen uit Word (#170) gemerged op 2026-11-07:** wie een export in Word verder bewerkt, kiest het bestand bij
  *Terughalen uit Word* in het overzicht. Het wordt in de browser gelezen; LimeOnIt herkent de
  hoofdstukken aan de LU-koppen van de export en toont per hoofdstuk of het anders is. Alleen wat
  de docent aanvinkt wordt overgenomen (`importChapters`), plus aangevinkte nieuwe bronnen.
  Bijlagen blijven in LimeOnIt leidend.
- **Open plekken toestaan in het BDB/BKE-dossier (#167) gemerged op 2026-11-07:** het landelijke
  startpunt kun je bevestigen als *voorlopig kader*; coach, alinea's en proefassessment werken dan,
  elk oordeel zegt "op het landelijke startpunt", en de export geeft alleen de conceptversie
  (BESLUIT-2026-11-07-5). Bewijs zonder tekst heet *Volgt nog*. *AI-leeractiviteit ontwerpen* kan
  zonder huidige activiteit en *Cursus op samenhang controleren* zonder pedagogische benadering
  (prompts `@v2`); vak, discipline en onderwerp komen in negen tools uit je onderwijscontext.
  Meting oc1: de nieuwe cases 4,20 en 4,40, geen gefaalde check. De oude contextualization-cases
  zakten (3,80 en 4,20, één run): de beoordelaar ziet een verzonnen werkveldcontext, iets wat de
  wijziging niet raakt; kandidaat voor een volgende `@v`.
- **Elke leeruitkomst apart inleveren, als Word of PDF (#168) gemerged op 2026-11-07:** bij elke leeruitkomst in het
  overzicht *Word* en *PDF*: een eigen document met titelpagina (LU-code en titel), dat hoofdstuk,
  de bronnen die het noemt en het bewijs bij de criteria van die LU. Een LU met een open plek geeft
  alleen een concept; zo kan LU1 al definitief terwijl LU3 nog concept is. Het hele dossier kan nu
  ook als PDF (printpagina, zoals P30.2), met CONCEPT boven en onder elke pagina bij een concept.
- **Geen open plek in het ingeleverde BDB/BKE-werk (#165) gemerged op 2026-11-07:**
  `[aanvullen: …]`, `[invullen]`, TODO, een leeg hoofdstuk of bewijs zonder tekst is een rood punt
  in *Klaar om in te leveren?*, en de schrijfpagina telt ze. Zolang er een staat, geeft de export
  alleen een conceptversie met CONCEPT, NIET INLEVEREN boven en onder elke pagina en op de
  titelpagina (BESLUIT-2026-11-07-4).
- **Het model op één plek (#156) gemerged op 2026-11-07:** `default` in `config/models.json` is
  de enige plek waar het standaardmodel staat; alle tools en de beoordelaar van de meetscripts
  halen het daar vandaan, en `tests/model-ids.test.ts` faalt op een model-id ergens anders.
  Stagebeoordeling opnieuw gemeten met Sonnet 5.5 als model en beoordelaar (sa55): gemiddeld
  4,06. Niet één op één te vergelijken met de oude meting (rond 5,0, andere beoordelaar). De
  beoordelaar ziet vooral eisen die niet in het kader staan (APA, MoSCoW) en oordelen die niet
  bij de uitleg passen; dat is een kandidaat voor een `@v2`.
- **P31.1b Kerncijfers bij Verdedig je werk (#152) gemerged op 2026-11-07:** een vinkje
  *Student plakt eerst de kerncijfers*, een herinnering per beurt (`ChatConfig.turnReminder`) en
  prompt `@v2`. Meting dyw4: gemiddeld 3,55 (was 3,2); één vraag per beurt nog niet helemaal.
- **Typfouten in de prompts (#150) gemerged op 2026-11-07:** zeven oudere Nederlandse
  chatprompts zonder kapotte woorden en Engelse resten; de Socratische partner (NL) vraagt net
  als de Engelse algemeen naar voorbeelden in plaats van naar selectiedruk.
- **P30.2 PDF en Markdown in het menu Exporteer (#146) gemerged op 2026-11-07:** het menu
  *Exporteer* biedt Word, *Print of bewaar als PDF* en Markdown; de losse Markdown-knop is weg.
- **P30.1 Exporteren naar Word (#144) gemerged op 2026-11-07:** onder elk resultaat een knop
  *Exporteer* met eerst een voorbeeld en dan *Download als Word*; meerdere stappen in één bestand.
- **Brief P30 Exporteren (#143) gemerged op 2026-11-07:** Word en PDF nu (30.1, 30.2), de
  rest na de pilot (BESLUIT-2026-11-06-5). Twee vragen voor Bastiaan staan in de brief.
- **AI-modellen beheren (#139) gemerged op 2026-11-06:** op "Tools en modellen" voegt een
  beheerder een model toe van elke gekoppelde aanbieder, upgradet een oud model naar een nieuwe
  versie (bijv. Haiku 4.5 → Haiku 5.5) en faseert het in twee stappen uit. De vaste lijst met
  aanbieders, modellen en hun instellingen (effort, temperatuur) staat in `config/models.json`.
- **OER-import met echte PDF's (#137) gemerged op 2026-11-06:** het hele document gaat mee (tot
  300.000 tekens), tabelrijen blijven rijen, en de docent ziet de uitleg van de AI als er niets te
  importeren valt.
- **LimeOnIt als Docker-build (#138) gemerged op 2026-11-06:** één `docker compose up -d` met een
  `.env` voor de sleutels; de database op een volume of eigen map. Gids: `docs/installatie-docker.md`.
- **Bestandsknop als echte knop (NL/EN, #135) gemerged op 2026-11-06:** de kale bladerknop van de
  browser is overal een LimeOnIt-knop "Kies bestand" met de gekozen bestandsnaam ernaast.
- **Alle schermen even breed op desktop (#136) gemerged op 2026-11-06:** elke pagina vult dezelfde
  breedte als de kopbalk (`max-w-6xl` in de AppShell); alleen leestekst (Over, Disclaimer, Cookies,
  een helpartikel) blijft een smallere, links uitgelijnde kolom. `tests/page-width.test.ts`
  bewaakt het.
- **Toetsvragen zonder correctie in een kopje (`test-items-items@v3`, #128) gemerged op
  2026-11-05:** het antwoordmodel staat per rij gegroepeerd, met de rij één keer in een eigen
  kopje en in elk vraagkopje alleen het nummer. Onder `@v2` kreeg de eerste vraag van een nieuwe
  rij soms de vorige rij mee ("Row R1 is not used; this is Row R2"). Getelde check
  `correctionInHeading` in de eval. Meting x: geen correctie meer in 18 runs, geen gefaalde check,
  niets afgekapt; opnieuw beoordeeld als x2 met een duidelijkere rubric: gemiddeld 4,67 (w: 4,77),
  create-with-mc 4,40. Dezelfde antwoorden schommelen per beoordeling tot 0,4.
- **Opgeruimd op 2026-11-05:** onder *Bezig* stonden nog twaalf PR's als "open" die al gemerged
  waren. Ze staan hieronder met hun nummer.
- **Wiskunde nakijken gemeten met een echte foto (#131 + meting mg1) op 2026-11-05:** een
  telefoonfoto van handgeschreven werk met één bewuste rekenfout (18x in plaats van 24x). Meting
  `2026-11-05mg1`: 4,80, geen gefaalde check; de tool vindt precies dat foutje en geeft een
  concept-8/10. Zwakste punt: een vervolgstap (numeriek controleren) is zwaar voor mbo-4.
- **Rolagenten alleen voor de hele instelling (#132) gemerged op 2026-11-05:** een team kan de
  schakelaar *Rolagenten* niet meer zien of omzetten; een eerder bewaarde teamkeuze telt niet meer
  mee (BESLUIT-2026-11-05-11, keuze Bastiaan). Een uitzondering per docent door de beheerder
  blijft. Geen migratie.
- **Flash-toasts na een redirect (P16, #130) gemerged op 2026-11-05:** na inloggen, uitloggen,
  een uitnodiging, een nieuw wachtwoord, verwijderen, een rubric kopiëren en stoppen als
  teamleider verschijnt op de volgende pagina een korte melding. Daarmee is P16 af.
- **Delen met je team (P28.4, #129) gemerged op 2026-11-05:** een cursus, rubric of
  onderwijscontext delen met een team; collega's bekijken en kopiëren. Studentwerk, chats en het
  dossier nooit. Migratie 0019 (`npm run db:migrate`). Daarmee is P28 af.
- **Lijst plakken bij Toevoegen (P28.5, #127) gemerged op 2026-11-05:** per regel naam en e-mail,
  een team kiezen, per persoon een uitnodigingslink of de reden van weigering.
- **Dubbel blok "Aandachtspunten" weg uit het dossieroverzicht (#126) gemerged op 2026-11-05.**
- **Opdracht helder schrijven, hooguit 8 open punten (`clear-assignment@v2`, #121) gemerged op
  2026-11-05:** meting ca3 elke case 4,53–5,00.
- **Toetsvragen, vaste vraagindeling in code (`test-items-items@v2`, #118) gemerged op
  2026-11-05:** eindmeting w elke case 4,67–4,87, niets afgekapt.
- **P27.4 De cursus als werkplek (#116) gemerged op 2026-11-05:** knoppen naar de passende tools bij
  elke les, toets en leeruitkomst, ook per regel van de week op Start; "Los op met…"; "Per week" op
  de cursuspagina. Daarmee is P27 af.
- **Rolagenten aan en uit in beheer (`/admin/agents`, #115) gemerged op 2026-11-05:** per pet Aan of
  Uit voor de hele instelling (BESLUIT-2026-11-05-11).
- **De week van de docent, agenda en documentatie (P22.4 + 22.5, #114) gemerged op 2026-11-05:**
  "Zet in je agenda" per cursus (`.ics`). Daarmee is P22 af.
- **Beheer sneller, tools (#112) gemerged op 2026-11-05:** zoeken, filteren op stand en "Zet alle
  getoonde tools op …".
- **Rolagenten, gekoppeld werk en documentatie (P21.7 + 21.8, #108) gemerged op 2026-11-05:** meting
  ra2 11/11, ra3 33/33. Daarmee is P21 af.
- **P27.3 Start en een menu van vier (#101) gemerged op 2026-11-05.**
- **Word-tabellen in de export (#99) gemerged op 2026-11-05:** een cursus als bewijs komt als echte
  tabel in de Word-export.
- **P28.3 Onderdelen, tools en modellen per team (#96) gemerged op 2026-11-05:** migraties 0016 en
  0017.
- **P27.1 Volgende stap onder elk resultaat (#87) en brief P28 (#90) gemerged op 2026-11-05.**
- **Documentatie van P29 (P29.4, #125) gemerged op 2026-11-05:** de wiki legt de klaar-check en
  het proefassessment uit, `evals/README.md` noemt `eval:rehearsal`. P29 is af.
- **Proefassessment in de werkplaats (P29.3, #124) gemerged op 2026-11-05:** in stap 5 "Oefen je
  eindgesprek met een proefassessment"; feedback als tabel per criterium, bewaren alleen op verzoek,
  het gesprek nooit. Besluiten 9–11 vastgelegd.
- **Proefassessment `@v2` (P29.2, #123) gemerged op 2026-11-05:** een sterk criterium krijgt één
  vraag, eerder stoppen mag; meting 11 van 12 runs zonder fout, elke case 3,73–4,53
  (`evals/reports/2026-11-05-portfolio-rehearsal-v2.md`).
- **Proefassessment, de AI-tekst en de meting (P29.2, #119) gemerged op 2026-11-05:**
  `portfolio-rehearsal@v1` speelt een commissie van twee assessoren met feedback per criterium,
  gecontroleerd in code; nog geen scherm.
- **Meting van het proefassessment hersteld (#122) gemerged op 2026-11-05:** de vraagteller slaat
  geciteerde vragen over; "vitten" en "claim overgenomen" gelden alleen in hun eigen case.
- **Kleine fixes (#120) gemerged op 2026-11-05:** de wankele toast-test is stabiel, en in Lastig
  gesprek staan de gebaren van de student in de ik-vorm (`difficult-conversation@v2`), zodat die
  niet meer van "haar" naar "zijn" wisselt; meting dc4 elke case 4,67–4,93.
- **Klaar om in te leveren? (P29.1, #117) gemerged op 2026-11-05:** in stap 5 van het
  BDB/BKE-dossier één lijst met per punt "Los op", zelf afvinken met datum; advies, geen poort.
- **De week van de docent op Start (P22.3, #113) gemerged op 2026-11-05:** per cursus *In de les*,
  *Voorbereiden* en *Nakijken*, vanaf vrijdag ook *Volgende week*; zonder startdatum een hint.
- **De week van de docent, puur (P22.2, #111) gemerged op 2026-11-05:** `teacherWeek` rekent per
  cursus deze week, voorbereiden, nakijken en aandachtspunten; nog geen scherm.
- **De week van de docent, echte datums (P22.1b, #110) gemerged op 2026-11-05:** een startdatum
  per cursus en bij elke les en toets "Week 3 · 17–23 nov", vakantieweken overgeslagen.
- **Gebruikers aanvinken en in één keer aanpassen (#109) gemerged op 2026-11-05:** op
  `/admin/users` "Met geselecteerde": in of uit een team, en (superbeheerder) op non-actief of
  weer actief, met een bevestigingsvraag bij op non-actief zetten.
- **De week van de docent, rekenhart en schoolkalender (P22.1a, #106) gemerged op 2026-11-05:**
  weken rekenen in ISO-weken en de vakantieweken als één lijst voor de instelling op
  `/admin/context`.
- **Teams als lijst met een pagina per team (#107) gemerged op 2026-11-05:** `/admin/teams` met
  zoeken en één knop "Nieuw team", per team een pagina waar je meerdere collega's tegelijk
  aanvinkt en toevoegt.
- **Cursus als bewijs in het BDB/BKE-dossier (P26.4 + 26.5, #95) gemerged op 2026-11-05:** op de
  cursuspagina "Gebruik als bewijs in BDB/BKE" als momentopname, "Opnieuw ophalen" in het dossier en
  een hint bij criteria over toetsmatrijs of afstemming. Plus de documentatie. Daarmee is P26 af.
- **OER-import (P26.3, #89) gemerged op 2026-11-05:** leeruitkomsten en toetsen uit een OER of
  studiehandleiding als voorstel dat de docent aanvinkt; eindmeting 18 van 18 runs geslaagd.
- **Matrijs uit de tool in de cursus (P26.2, #94) gemerged op 2026-11-05:** bij een gekoppelde
  toetsmatrijs staat "Zet matrijs in cursus"; de docent kiest de toets en per rij de leeruitkomst.
- **Toetsmatrijs per vraag (P26.1, #92) gemerged op 2026-11-05:** per toets een tabel met per vraag
  leeruitkomst, denkniveau, vraagvorm en punten; de vragen bepalen de dekking.
- **Teams en teamleiders (P28.2, #93) gemerged op 2026-11-05:** teams op `/admin/teams`, een
  teamleider beheert zijn team op `/teams/:id`, uitnodigen in een team, "Mijn teams" op de
  accountpagina.
- **Gebruikersbeheer in een paar klikken (P28.1, #91) gemerged op 2026-11-05:** één lijst met
  zoeken en filteren, status en laatst actief, uitnodigingen als rij, één knop "Toevoegen" en een
  pagina per persoon (`/admin/users/:id`).
- **BDB/BKE doet mee (P27.2, #88) gemerged op 2026-11-05:** "Dit heb je misschien al" (eerder werk
  als bewijs voorstellen), de route in vijf stappen bovenaan het dossier, de BDB/BKE-schakelaar per
  docent en de weg terug van criterium naar tool en weer terug.
- **Cursussen, de documentatie (P20.5, #86) gemerged op 2026-11-05:** alinea in `AGENTS.md`, wiki
  en README. Daarmee is P20 af.
- **Cursussen koppelen (P20.4, #84) gemerged op 2026-11-05:** bovenaan tien toolpagina's een
  cursuskiezer die de leeruitkomsten invult en het resultaat aan de cursus koppelt; koppelen op
  "Mijn werk"; "Gekoppeld werk" op de cursuspagina.
- **Brief P27 De rode draad (#83) gemerged op 2026-11-05:** één workflow met de cursus als
  thuisbasis, volgende stap onder elk resultaat, BDB/BKE doet mee, startscherm met drie ingangen en een
  menu van vier (BESLUIT-2026-11-05-4).
- **Rolagenten, pakket-tags bij leeruitkomsten (P21.6, #105) gemerged op 2026-11-05:** kenmerken
  uit het pakket van de cursus per leeruitkomst; de petten krijgen ze mee.
- **Rolagenten, het paneel "Beoordeling" (P21.5, #104) gemerged op 2026-11-05:** knop, adviezen per
  pet, Akkoord / Niet akkoord met reden, melding als de cursus daarna is gewijzigd.
- **Rolagenten, "Laat beoordelen" aan de serverkant (P21.4, #103) gemerged op 2026-11-05:** beide
  petten kijken de cursus na op het gekozen model; besluiten worden vastgelegd.
- **Rolagenten, opslag (P21.3, #102) gemerged op 2026-11-05:** beoordelingen van een pet en de
  besluiten van de docent worden bewaard (migratie 0018); verworpen adviezen komen niet terug.
- **Rolagenten, petten als data (P21.1, #81) gemerged op 2026-11-05:** register van de twee petten,
  de invoer onder korte sleutels en de controle op het antwoord; nog zonder AI en scherm.
- **Rolagenten, de twee AI-teksten (P21.2, #85) gemerged op 2026-11-05:** Toetsdeskundige en
  Ontwerper (NL/EN) met de meting `npm run eval:agents`; tussenronde ra1 10 van 10 geslaagd, de
  eindmeting (3 runs) wacht op akkoord.
- **Cursussen, de pagina's (P20.3, #82) gemerged op 2026-11-05:** menu-item "Cursussen", per
  cursus de gegevens met EC, leeruitkomsten, activiteiten, toetsen, aandachtspunten en de
  dekkingsmatrix.
- **Brief P21 Rolagenten (#80) gemerged op 2026-11-05:** twee petten kijken een cursus na op
  verzoek, met akkoord/niet akkoord (BESLUIT-2026-11-05-3); 21.1 kan starten.
- **Cursussen, opslag (P20.2, #79) gemerged op 2026-11-05:** tabellen `courses` en `course_links`
  (migratie 0014), per docent afgeschermd.
- **Brief P26 Cursussen verder (#77) gemerged op 2026-11-05:** toetsmatrijs per vraag,
  OER-import en de cursus als bewijs in het BDB/BKE-dossier, na P20 (BESLUIT-2026-11-05-2).
- **Cursussen, het rekenhart (P20.1, #78) gemerged op 2026-11-05:** cursusmodel met
  leeruitkomsten, activiteiten, toetsen, Bloom en studielast, en de afstemmingscontroles; nog geen
  scherm.
- **Lastig gesprek oefenen (P24.8, #75) gemerged op 2026-11-05:** de AI speelt een verzonnen
  student in een moeilijk gesprek en geeft daarna feedback met citaten; eindmeting dc3 elke case
  4,60–4,93.
- **Opdracht differentiëren (P24.7, #76) gemerged op 2026-11-05:** drie varianten met hetzelfde
  leerdoel naar Tomlinson (2017); eindmeting df2 elke case 4,73–5,00.
- **Opdracht helder schrijven (P24.6, #73) gemerged op 2026-11-05:** opdracht of handleiding
  herschreven op taalniveau B1 met open punten en eisencheck; eindmeting ca2 elke case 4,67–5,00.
- **Toetsanalyse na afloop (P24.5, #74) gemerged op 2026-11-05:** hulpmiddel item-analysis rekent,
  tool test-analysis legt uit; eindmeting ta3 elke case 4,53–4,93.
- **Les voorbereiden (P24.4, #72) gemerged op 2026-11-05:** concept-lesopzet volgens Rosenshine
  (2012), met een tijdsplan dat optelt tot de lesduur; elke case 4,53–5,00 in meting lp3.
- **Toetsvragen en toetsmatrijs (P24.3, #67) gemerged op 2026-11-05,** in de stand van meting t;
  de bekende punten staan onder Later.
- **Beoordelingsmodel: een gebrek telt bij één criterium (#71) gemerged op 2026-11-04:** na meting q;
  meting s zonder regressie.
- **Product:** LimeOnIt, docententools op basis van *The Pedagogical Promptbook*: 16 tools (10 voor
  docenten, 6 tutors), tweetalig NL/EN, gericht op hbo.
- **Gebruik:** pilot met een aantal docenten en leden van een examencommissie.
- **Stack:** React Router 8, SQLite (Drizzle), AI SDK (standaard Claude Sonnet 5.5) + lokale modellen,
  Vitest + axe. Ruim 2600 tests, CI groen op `main`.
- **Laatst op `main` (2026-11-03):** V1 (P17) gemerged en uitgerold: de studentenlaag is eruit en de
  studentdata is gewist; de back-up van vóór de migratie wordt op 2026-11-10 verwijderd. Eerder: P15
  (toasts, navigatie-toegankelijkheid), Claude 5.5-modellen, documenten tot 300k tekens, briefs
  P20–P22, de fabriek.
- **P23.1 + 23.2 gemerged op 2026-11-04:** de plek voor hulpmiddelen, de cijferrekenaar en rubrics
  bewaren (migratie 0012).
- **Nulmeting (#51) en de reparaties erna (#52) gemerged op 2026-11-04.**
- **Eerder op 2026-11-04 gemerged:** V3 helemaal (P19.2–19.6, #30–#34), de briefs P23/P24 (#36),
  Zod 4 (#38), P23.1 + 23.2 (#42), schermteksten en routes per onderdeel (#45) en P25 "welke tool
  bij welke stap" (#46).
- **Eerlijke bronvermelding (#64) gemerged op 2026-11-04:** bij elf boektools staat nu de echte
  boekprompt als origineel, met de auteurs en pagina's zoals gedrukt. Daarmee is P24.0 klaar.
- **React Router 8 en React 19.3 (#65) gemerged op 2026-11-04:** `npm run dev` start zonder
  waarschuwingen; `meta` en `useMatches` lezen `loaderData`. `vite-node` viel daarbij weg (#68).
- **Begeleide reflectie v2 (#63) gemerged op 2026-11-04:** de drie fasen van Backward Design uit
  het boek, eerst aanscherpen bij vage invoer; gemiddeld 3,4 → 4,8 (`evals/reports/2026-11-04l.md`).
- **Dialogisch gesprek v2 (#62) gemerged op 2026-11-04:** het interview uit het boek; gemiddeld
  3,0 → 4,1 (`evals/reports/2026-11-04i.md`).
- **MentorAI v2 (#61) gemerged op 2026-11-04:** de leermeester uit het boek, met eerlijke
  bronvermelding; gemiddeld 2,5 → 3,4 (`evals/reports/2026-11-04f.md`).
- **P25.4 kader-extractie (#59) en P23.3 rubric invullen in batches (#60) gemerged op
  2026-11-04;** na #60 `npm run db:migrate` (migratie 0013).
- **Strengere meting (#56) gemerged op 2026-11-04:** drie runs per case, harde ja/nee-checks met
  een plafond, een afgekapt antwoord hooguit een 3; Begeleide reflectie 12288 tokens. Nulmeting d:
  `evals/reports/2026-11-04d.md`.
- **Tweede meting (#54), P24.1 (#53) en lege antwoorden (#55) gemerged op 2026-11-04:** Stage
  Assessment heet nu "Studentwerk beoordelen en feedback geven"; Claude 5.5 krijgt extra denkruimte,
  zodat een antwoord niet meer leeg blijft of halverwege ophoudt.
- **P24.0c en 24.0b gemerged op 2026-11-04 (#49, #50):** het originele document naast de tekst
  voor de AI, en anonimiseren vóór het versturen.
- **P25 PR B (#41) en de Word-export (#40) gemerged op 2026-11-04:** de werkplaats is te gebruiken
  zonder AI, met export naar Word.
- **P25 PR A (#39) gemerged op 2026-11-04:** het dossier en de opslag van de BDB/BKE-werkplaats;
  migratie 0011 gedraaid.
- **V2 (P18) klaar en uitgerold op 2026-11-04:** PR's #17, #19, #21–#28; migraties 0009 en 0010 gedraaid; back-up `data/limeonit-voor-p18.db`; superbeheerder ingesteld.

## Verzoeken

- 2026-11-03: "Haal weg wat overbodig is. Als we het op een eenvoudigere en efficiëntere en
  doeltreffendere manier kunnen bouwen, dan ben ik daar een voorstander van." → vereenvoudiging
  V1–V3 hieronder.
- 2026-11-03: "Ik denk wel dat de admin modellen moet kunnen toewijzen … per instelling en kan de
  admin dat per docent overrulen." → onderdeel van V2.
- 2026-11-04: "welke tools we nog meer kunnen maken/aanbieden … Wat missen we allemaal?" →
  onderzoek (Claude Doc, 2026-11-04). Daarna: "nuttige tools … die geen LLM nodig hebben" en "Ja geef
  ze een eigen plek" → BESLUIT-2026-11-04-5, brief P23. Daarna: tools 1 t/m 8 en eerst de nulmeting →
  BESLUIT-2026-11-04-7, brief P24.
- 2026-11-03: "Ik wil ook niet bij beheer op elke tabel regel een opslaan knop hebben. Of eentje
  onderop, of hij slaat automatisch op" → V2: automatisch opslaan met melding.
- 2026-11-03: "Ik mis de stageverslagen checker" (hij heet 'Beoordelingsassistent — stage &
  afstuderen' en was onvindbaar) → V3: duidelijkere toolnamen.
- 2026-11-03: "Ik wil een super beheerder. Dat ben ik. Die kan andere beheerders aanmaken en alles.
  Beheerders kunnen geen andere beheerders aanmaken." → V2 (P18.6).
- 2026-11-03: "Ik wil als superbeheerder ook users kunnen aanmaken zonder email verzoek" → V2
  (P18.7).
- 2026-11-03: "Ook dat wil ik kunnen doen. Resetten, wachtwoord link versturen en zelf een
  wachtwoord invoeren. Ook user account op non-actief kunnen zetten" → V2 (P18.7).
- 2026-11-04: "Hoe kunnen we beginnende docenten begeleiden om hun BDB en BKE goed te maken en
  makkelijk voor ze maken? Ik vind dat we met deze tool de BDB en BKE binnen een paar dagen moeten
  kunnen afronden en wederom met een hele hoge kwaliteit." → brief P25 (werkplaats).
- 2026-11-04: "Voor de BDB/BKE denk ik dat we een dedicated deel van de applicatie hieraan moeten
  wijden." → BESLUIT-2026-11-04-11.
- 2026-11-04: "Maak het ook mogelijk om te importeren van tools als TestVision, ANS, Remindo" → BESLUIT-2026-11-04-16, vervolg op P25.
- 2026-11-05: "Kunnen we niet alvast beginnen met de volgende P20 features?" en "Ik wil 2 t/m 5 wel
  hebben" → P20 met studielast en de P24-tools erbij; toetsmatrijs, OER-import en BDB/BKE naar P26
  (BESLUIT-2026-11-05-1).
- 2026-11-05: "Hoe kunnen we deze applicatie super effectief maken en een genot om mee te werken?",
  "voor de BDB/BKE functie zoveel mogelijk integratie van de tools en wellicht ook een aparte
  workflow" en "alle drie aanbieden?" → document "LimeOnIt als één workflow", BESLUIT-2026-11-05-4,
  brief P27.
- 2026-11-05: "Ik vind dat het gebruikersmanagement in beheer veel beter kan … teams kunnen aanmaken
  van meerdere collega docenten … per team features aan en uit" → document "Teams, privacy en
  gebruikersbeheer", BESLUIT-2026-11-05-5, brief P28.
- 2026-11-06: "Ik wil sowieso export mogelijkheden voor BrightSpace, GradeWork, MS Excel, MS Word,
  Presentaties naar MS Powerpoint, PDF export, etc", plus sjablonen voor PowerPoint en viewers in
  LimeOnIt → brief P30, BESLUIT-2026-11-06-4.
- 2026-11-07: "Welke tools uit het boek missen we nog?" → bijlage F (mondelinge verdediging) en G
  (zes leerprincipes) van *From Oracle to Socratic Partner* worden nog niet gebruikt; "Ja" → brief
  P31, BESLUIT-2026-11-07-1.

## Bezig

- **Prompt caching voor elke aanbieder (PR open):** in een chat stuurt LimeOnIt bij elke beurt
  dezelfde lange systeemprompt en het hele gesprek opnieuw. Nu vraagt het de aanbieder dat te
  bewaren, zoals die aanbieder het wil (`cache` per aanbieder in `config/models.json`): Claude
  krijgt markeringen, OpenAI, Mistral en OpenRouter een vaste sleutel per docent en tool (als
  hash), de rest cachet zelf. Alleen bij chats; een losse generatie krijgt niets.
- **De handleiding BDB en BKE in de app (PR open, plan BDB en BKE PR 2):** helponderwerp
  `bdb-bke` (NL/EN) van stap 0 (*Op aanvraag* aanzetten) tot inleveren, met open plekken, elke
  leeruitkomst apart en terughalen uit Word. Onder de route van het dossier staat een link naar de
  stap waar je bent; helponderwerpen geven hun koppen daarvoor een anker (`headingSlug`).
- **Proeflezen en het hele dossier laten beoordelen (BDB/BKE, PR 4 van het plan; PR open):**
  naast *Laat beoordelen* staat *Lees proef*: voorstellen voor spelling, zinsbouw, ik-vorm,
  herhaling en APA, elk met de zin zoals hij nu is en een betere versie. *Overnemen* vervangt
  precies die zin in je hoofdstuk, *Negeren* haalt het voorstel weg. Een voorstel dat niet
  letterlijk in je hoofdstuk staat, valt weg in code. In stap 5 beoordeelt *Beoordeel het hele
  dossier* alle hoofdstukken in één keer, met per leeruitkomst een overzicht. Nieuwe prompt
  `portfolio-proofread@v1` met evals (`npm run eval:proofread`); geen migratie.
- **Figuren uit het document meesturen (PR open):** bij *Studentwerk beoordelen* zie je na het
  uploaden de afbeeldingen uit Word en de PDF-pagina's met een figuur als plaatjes bij
  *Kernfiguren*. Standaard gaat er niets mee; wat je aanvinkt gaat naar het model (max. 10), met
  de melding dat afbeeldingen niet geanonimiseerd worden. Ook: geüploade plaatjes waren zwart in
  het voorbeeld, de teller was Engels en *Kernfiguren* had onterecht een sterretje.
- **Tabbladen boven de viewer niet meer afgesneden (PR open):** sinds de rechterkolom zelf scrolt
  (#162) viel de rand van *Origineel* en *Wat de AI krijgt* weg; de kolom houdt nu 4px ruimte
  binnen haar randen voor zulke randen en focusringen.
- **Minder witruimte onder *Formulier uitklappen* (PR open):** het ingeklapte formulier liet
  nog 16px extra ruimte achter onder de knop; nu staat er evenveel ruimte boven als onder. En:
  *Exporteer* openklappen drukte resultaat en viewer plat tot alleen hun kop (de tekst onder de
  viewer liep over de lijnen); ze houden nu een minimumhoogte en de kolom scrolt zelf.
- **Formulier in- en uitklappen bij een resultaat (PR open):** zodra er een resultaat staat, klapt
  de docent het formulier weg met *Formulier inklappen*; resultaat en documentviewer krijgen dan de
  volle breedte (op een breed scherm naast elkaar). *Formulier uitklappen* haalt het terug, met alle
  invoer nog ingevuld. Geldt voor elke formulier-tool en ook voor de tools met stappen
  (`FormResultLayout`). In dezelfde PR twee viewer-verbeteringen: een klik op een citaat markeert
  de woorden zelf op de PDF-pagina (of in de Word-alinea) en scrolt daarheen, en een PDF wordt bij
  inzoomen opnieuw getekend op de getoonde grootte, zodat de tekst scherp blijft.
- **Eerlijker meten bij Verdedig je werk (PR open):** de beoordelaar ziet alleen de checks die
  hij zelf beoordeelt, en moet elke fout bewijzen met een letterlijk citaat dat de code in het
  gesprek terugvindt; een dubbele vraag in één zin (`compoundQuestion`, cap 4) telt de code zelf.
  Geldt voor alle tools. Nulmeting dyw4r: de dyw4-gesprekken opnieuw beoordeeld, 3,57; alle
  verzonnen fouten weg. Twee pogingen tot een `@v3` (dyw5 3,46, dyw6 3,59) waren niet beter:
  `@v2` blijft live. Een dubbele vraag blijft in 26 van 30 gesprekken staan; met alleen
  promptwoorden lukt dat niet.
- **"Wat de AI krijgt" toont de geanonimiseerde tekst (PR open):** na *Verstuur geanonimiseerd*
  liet de documentviewer bij Stagebeoordeling nog de tekst met namen zien. De AI kreeg wel al
  alleen codes (geen privacylek); nu toont het tabblad ook precies die tekst, tot de docent het
  formulier weer aanpast.
- **Pagina met documentviewer scrolt niet meer voorbij de footer (PR open):** de verborgen
  voorleestekst in de klikbare citaten (#155) rekte op een telefoon de pagina op tot ver na de
  footer; de scrollzone van de app verankert zulke tekst nu voor alle pagina's. Daarnaast past de
  meescrollende rechterkolom (viewer en resultaat) nu precies onder de kop, in plaats van 49px onder
  het scherm, en sleept scrollen in de viewer of het resultaat de pagina niet meer mee.
- **P31.2 Een verdediging nakijken (PR open):** de docent plakt het gesprek van een
  mondelinge verdediging en krijgt een concept (bijlage F.4, letterlijk overgenomen en algemeen
  gemaakt): het niveau van begrip (uitstekend, op niveau, in ontwikkeling, beginnend), opvallende
  leerhoudingen, feedback voor de student en notities voor de docent. Studentwerk: eerst
  anonimiseren in de browser (verplicht, BESLUIT-2026-11-07-2), de docent beslist, nooit gedeeld.
  Wat de AI in het gesprek zei, telt niet mee. Volgende stap onder *Verdedig je werk*. Meting dr1:
  gemiddeld 4,52 (één vals alarm van de judge); F.4 woord voor woord gecontroleerd. Met de docs
  van 31.4.
- **Vanuit de feedback naar de tekst springen (PR open):** bij de drie tools met een document
  wordt elk letterlijk citaat in het resultaat een link. Klik erop en de viewer springt naar die
  plek en kleurt hem geel (bij een PDF met paginanummer). Alleen citaten die echt in het origineel
  staan worden een link; een parafrase blijft gewone tekst. Op telefoon en laptop brengt *Terug naar
  de feedback* je terug. Het oude lijstje citaten onder de viewer is weg. Geen promptwijziging;
  stap 2 (een anker bij élk feedbackpunt, nieuwe prompt plus meting) wacht op Bastiaan.
- **Documentviewer past op de pagina, met zoomen (PR open):** een geüploade PDF of Word bij
  *Studentwerk beoordelen* (en de twee andere tools met een documentveld) brak de pagina: een brede
  tabel of lange link maakte de viewer breder dan het scherm, een lang document groeide onder de
  kolom uit, en de verborgen voorleestekst per PDF-pagina rekte de hele pagina op. Nu blijft de
  viewer binnen zijn kolom en scrolt het document erin. Nieuw: in- en uitzoomen (50–300%).
- **Andere AI-modellen meten (PR open):** `npm run eval -- --model gpt-6.1-sol` laat een ander
  model dezelfde cases beantwoorden, met dezelfde (Claude-)beoordelaar, zodat je ziet of de op
  Claude afgestemde prompts ook elders werken. Nog niets gemeten; dat kost per model ruwweg
  €1–3 en wacht op Bastiaans akkoord. Daarbij een fix: Ollama kreeg geen contextgrootte mee en
  kapte een lang document zonder melding af; nu 32768 tokens (`OLLAMA_NUM_CTX`).
- **P31.3 De leercheck (PR open):** de nieuwe tool "Hoe actief leren je studenten?" scoort een
  opdracht of les op de zes leerprincipes uit bijlage G van het boek, met per principe een niveau
  van Afwezig (0) tot Hoog (3), een reden en twee à drie verbeteringen. De score (bijv. 9 van 18,
  50%) rekent LimeOnIt zelf uit en staat onder het resultaat, niet de AI. Volgende stap na een
  lesopzet, een heldere opdracht en differentiëren. Meting nog te draaien (`npm run eval -- --tool
  engagement-check`).
- **Code in Word en PDF (PR open):** een codeblok uit een resultaat (zoals ` ```python `) staat in
  Word, in de PDF en in het voorbeeld als blok in een vaste-breedteletter op een lichtgrijze band,
  met kleuren per taal (dezelfde kleuren als in de app, iets donkerder voor papier) en met de
  inspringing zoals geschreven. Code in een zin (`zo`) krijgt ook die letter. Geen nieuwe
  bibliotheek: dezelfde `rehype-highlight` als op het scherm.
- **Spraak: voorlezen en dicteren (PR open):** onder elk toolresultaat en chatantwoord een knop
  *Voorlezen*, met een stem die op het apparaat zelf draait (nooit een online stem). En een
  microfoonknop in de chat en in elk tekstvak van een formulier: de opname gaat via LimeOnIt naar
  een Whisper-server (whisper.cpp in Docker met `--profile speech`, op de eigen computer, of
  OpenAI) en komt terug als tekst. Zonder `WHISPER_BASE_URL` in `.env` is er geen microfoonknop.
  Nooit de spraakdienst van Chrome (die stuurt audio naar Google).
- **Pilotfeedback van docenten (PR open):** onder elk bewaard resultaat geeft een docent een
  duim, en daarna als hij wil: hoeveel tijd het scheelde (0, 15, 30 of 60+ minuten), een
  kwaliteitscijfer van 1 tot 5 en een opmerking. Op Start staat af en toe een korte
  check-in (wat hielp, wat ergerde, wat mis je), na drie resultaten en dan hooguit eens per twee
  weken; "Niet nu" klikt hem weg. Het onderdeel *Pilot-check-in* kan uit per team of voor
  iedereen. In Beheer → Gebruik en feedback staat *Pilot per tool*: gebruik, duimen, tijd,
  kwaliteit en opmerkingen, te filteren per team. Migratie 0020 (`npm run db:migrate`).
- **Aanbieders toevoegen in Beheer (PR open):** op "Tools en modellen" voegt een beheerder een
  nieuwe aanbieder toe met een naam en een adres, ook een eigen server op het netwerk van de
  school (die mag `http` gebruiken en hoeft geen sleutel; werkt ook in productie). De sleutel komt
  in `.env` onder een eigen naam (`<NAAM>_API_KEY`), nooit in het scherm. Een aanbieder zonder
  modellen kan weer weg. De zin "Opus-klasse blijft serverzijdig" is gewone taal geworden. De
  lange pagina is opgedeeld in drie tabbladen: *Tools* (onderdelen en tools aan/uit), *Modellen*
  (alle modellen, wat docenten mogen kiezen, model toevoegen) en *Aanbieders* (koppelen,
  toevoegen, modellen op deze computer). Nog steeds één pagina (BESLUIT-2026-11-03-14).

## Wacht op jou

- Niets.

## Volgende (volgorde gekozen door Bastiaan, 2026-11-04)

Klaar: V1 (P17), V2 (P18), V3 (P19), P23.1–23.3, P24.0b/0c/1, P25.1–25.6.

1. **P24.0 afmaken** (spoor A, achter elkaar): meting d → MentorAI v2 (klaar) → Dialogisch gesprek (klaar) →
   Begeleide reflectie (klaar) → de andere tools (bronvermelding, klaar), elk een PR met meting ervoor en erna (BESLUIT-2026-11-04-23).
2. **P24.2–24.8, de nieuwe AI-tools**: na #56, eerst 24.2 (beoordelingsmodel) en 24.3
   (toetsvragen en toetsmatrijs); hooguit twee tegelijk.
3. **P20** (cursussen), dan **P26.3** (OER-import), dan **P27.1 + 27.2** (volgende stap,
   BDB/BKE doet mee), dan **P28.1–28.3** (gebruikersbeheer, teams, aan/uit per team), dan **P27.3** (Start en menu), **P21** (rolagenten) en **P27.4**, dan **P22**
   (de docentweek, op Start), dan **P28.4–28.5** (delen, meerdere tegelijk), dan de rest van **P26** (BESLUIT-2026-11-05-4, -5).
   Stand 2026-11-05: alles tot en met P28.3, P22, P26, P27 en P29 is gemerged; P28.4 (#129) en P28.5 (#127) ook. P28 is af.

## Open vragen

- De privacy-officer kijkt later mee naar het anonimiseren (24.0b, BESLUIT-2026-11-04-20).
- De privacy-officer kijkt later mee naar het rubric-invullen in batches (P23.3, BESLUIT-2026-11-04-8).

## Later (bewust geparkeerd)

- **Examencommissie** (aparte flow over meerdere cursussen), na de pilot, bouwt op opleidingen en
  leerlijnen.
- Add-on **praktijksimulaties** (Webshop Bob, fotorealistische avatars).
- Spraak (dicteren, voorlezen).
- De studentenlaag, opnieuw en beter.
- Het evaluatie-harnas: de nulmeting is nog nooit gedraaid.
