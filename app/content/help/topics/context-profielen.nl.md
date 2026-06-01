# Onderwijscontext instellen

Een **contextprofiel** beschrijft jouw onderwijssituatie één keer, zodat elke tool er rekening mee houdt. Het profiel wordt als achtergrond aan elke prompt meegegeven (`{{context}}`), zonder dat je het telkens opnieuw hoeft te typen.

## Een profiel aanmaken

Ga naar **Onderwijscontext**. Er staat standaard nog geen profiel klaar — je maakt er zelf één aan op de manier die je prettig vindt:

- **Met de wizard** — stap voor stap, met uitleg en aanbevolen velden per domein.
- **Zelf invullen** — alle velden op één pagina.

Beide vragen om hetzelfde:

- **Naam** — bijv. "Software Engineering — jaar 2".
- **Opleiding, vak, studiejaar, EQF-niveau** — bepalen toon en niveau van de output.
- **Beoogde competenties / leeruitkomsten** — waar het onderwijs op stuurt.
- **Beroepspraktijk** — voor welk werkveld je opleidt.

## Domeinkader per domein

Kies je een **domein/sector**, dan verschijnen de relevante velden uit het landelijke raamwerk van dat domein — bijvoorbeeld de hbo-i-architectuurlagen voor ICT, de CanMEDS-rollen voor Zorg & welzijn, of de leeruitkomsten van HBO-Rechten. Bij elk kader staat de **bron** vermeld.

Vink bij die velden alleen aan wat je opleiding écht raakt — bijvoorbeeld voor een Software Engineering-vak de laag *Software* en de activiteiten *Ontwerpen* en *Realiseren*, niet het hele kader. Het kader noemt álle dimensies van het domein, maar een vak raakt er meestal maar een paar; aanvinken wat niet van toepassing is, verwatert de context en levert de tools een vager beeld. Het EQF-niveau staat op 6 (hbo-bachelor) en zodra je een **studiejaar** kiest, wordt het beheersingsniveau voorgesteld (jaar 1 → 1, jaar 4 → 3; tussenjaren → 2). Pas elk veld gerust aan of verwijder het.

Heeft een domein geen landelijk vastgesteld raamwerk (zoals Agro of Overig), dan zie je dat duidelijk terug en voeg je zelf de relevante velden toe.

## Eigen velden

Met **Eigen velden** voeg je voor elk profiel zelf extra naam-/waardeparen toe. Die worden net als de rest aan elke prompt meegegeven — handig voor specialisaties of accenten die niet in een standaardkader passen.

Zet één profiel als **standaard**; dat wordt dan vooraf geselecteerd op de toolpagina's.

## Waarom het belangrijk is

Zonder context maakt een tool generieke output. Met een goed profiel sluit het materiaal aan op je opleiding, niveau en werkveld — dat scheelt veel naredigeren. Je kunt meerdere profielen aanmaken (bijv. per vak) en per generatie kiezen welk profiel je gebruikt.
