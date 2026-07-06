# Je onderwijscontext instellen

Een **contextprofiel** beschrijft jouw onderwijssituatie één keer, zodat elke tool er rekening mee houdt. Het profiel wordt als achtergrond aan elke prompt meegegeven (`{{context}}`), zonder dat je het telkens opnieuw hoeft te typen.

## Eén editor, vier stappen

Ga naar **Onderwijscontext** en klik op **Nieuw contextprofiel**. Er is één duidelijke editor die je in vier stappen langs alles leidt — dezelfde editor gebruik je later om een profiel te **bewerken**.

1. **Basis** — de **naam** (bijv. "Software Engineering — jaar 2"), het **land**, het **onderwijstype**, en optioneel opleiding en vak.
2. **Niveau & kader** — het NLQF-niveau (met afgeleid EU-niveau) en het domein/vak met eventueel landelijk kader.
3. **Context & eigen velden** — beroepspraktijk, technologie/methoden, onderwijsconcept, aanspreekvorm en eigen velden.
4. **Afronden** — een korte samenvatting; zet het profiel eventueel als standaard.

## Land → onderwijstype → niveau

Je begint met **land** en **onderwijstype**. Het onderwijstype (voortgezet onderwijs, mbo, hbo of wo — met bijbehorende leerweg of graad, zoals vmbo-kb, havo, mbo-4 of hbo-bachelor) bepaalt de rest: het stelt automatisch het passende **niveau** voor en bepaalt welke vakken/domeinen je kunt kiezen.

Het niveau leg je vast als **NLQF-niveau** — het Nederlandse kwalificatieraamwerk is de bron van waarheid. De editor toont er het **afgeleide EU-niveau (EQF)** bij en een link naar de bron ([nlqf.nl](https://nlqf.nl/impact-nlqf/nlqf-niveaus-waaier/)). Belangrijk: in de prompt komt alléén dat EQF-getal plus een neutrale niveau-instructie terecht — nooit de term "NLQF" zelf. Zo blijft de engine landneutraal terwijl jij in vertrouwde Nederlandse termen kiest. De Instroomniveau-optie wordt als instapniveau (net onder EQF 1) meegegeven.

## Kader per domein

Kies je een **domein/vak**, dan verschijnen de relevante velden uit het landelijke raamwerk van dat domein — vandaag alleen voor het **hbo** (bijvoorbeeld de hbo-i-architectuurlagen voor ICT, de CanMEDS-rollen voor Zorg & welzijn, of de leeruitkomsten van HBO-Rechten). Bij elk kader staat de **bron** vermeld.

Vink bij die velden alleen aan wat je opleiding écht raakt — niet het hele kader. Voor het hbo staat het niveau op de bachelor en zodra je een **studiejaar** kiest wordt het beheersingsniveau voorgesteld (jaar 1 → 1, jaar 4 → 3; tussenjaren → 2).

Voor **vo** en **mbo** zijn (nog) geen landelijke kaders ingebouwd. Je ziet dan eerlijk dat er geen vastgesteld raamwerk is en voeg je zelf de relevante velden toe — er wordt niets verzonnen.

## Aanspreekvorm en onderwijsconcept

De aanspreekvorm volgt automatisch uit het onderwijstype: in het vo heten de lerenden **leerlingen**, in mbo/hbo/wo **studenten** (in het mbo kun je wisselen naar **deelnemers**). De begeleider heet **docent**. Zo gebruiken de tools de juiste woorden zonder dat jij iets hoeft aan te passen.

Met **Onderwijsconcept / didactische aanpak** geef je optioneel je pedagogische aanpak mee (Montessori, Dalton, Jenaplan, probleemgestuurd…). Die tekst wordt letterlijk in elke prompt meegenomen.

## Eigen velden

Met **Eigen velden** voeg je voor elk profiel zelf extra naam-/waardeparen toe. Die worden net als de rest aan elke prompt meegegeven — handig voor specialisaties of accenten die niet in een standaardkader passen.

Zet één profiel als **standaard**; dat wordt dan vooraf geselecteerd op de toolpagina's.

## Voor beheerders: standaarden en aangepaste toegang

Ben je **beheerder**, dan stel je op de beheerpagina **Onderwijscontext** de standaarden voor de hele omgeving in: welke **landen**, welke **onderwijstypen** en — onder **Domeinen / profielen** — welke vakgebieden docenten mogen kiezen. Land en onderwijstype houden altijd minstens één keuze; laat je **Domeinen / profielen** leeg, dan zijn álle domeinen beschikbaar.

Standaard **erft** elke docent deze instellingen. Wil je één docent een andere scope geven, zet dan bij die docent **Aangepaste toegang activeren** aan. De eigen keuze van die docent **vervangt** dan de omgevingsstandaard volledig — zo kun je méér toestaan dan de standaard of juist minder. Een as die je leeg laat betekent "alles"; de omgevingsstandaard telt voor die docent dan niet meer mee.

Zet je **Aangepaste toegang** later weer uit, dan erft de docent gewoon weer de standaarden. Dat gaat **zonder verlies**: de keuzes die je voor die docent had opgeslagen blijven bewaard en komen terug zodra je de aangepaste toegang opnieuw activeert.

## Waarom het belangrijk is

Zonder context maakt een tool generieke output. Met een goed profiel sluit het materiaal aan op je onderwijstype, niveau en werkveld — dat scheelt veel naredigeren. Je kunt meerdere profielen aanmaken (bijv. per vak) en per generatie kiezen welk profiel je gebruikt.
