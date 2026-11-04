# LimeOnIt

Evidence-based onderwijs ontwerpen met generatieve AI. LimeOnIt zet de
onderwijsmethoden uit **The Pedagogical Promptbook** (David Wiley, red. — CC BY 4.0)
om in werkende tools. Elke tool koppelt een onderwijstheorie aan een zorgvuldig
ontworpen, geëvalueerde prompt. De eerste focus ligt op het **hbo-i** (hoger
beroepsonderwijs ICT) en op Nederlandstalige uitvoer.

## Snel starten

```bash
npm install
cp .env.example .env        # vul ANTHROPIC_API_KEY in
npm run db:migrate          # maakt data/limeonit.db aan
npm run dev                 # http://localhost:5173
```

Zonder `ANTHROPIC_API_KEY` start de app wel, maar genereren geeft een nette
foutmelding. Een key haal je op via https://console.anthropic.com/.

## Waar we staan (november 2026)

LimeOnIt draait als pilot met docenten in het hbo. De app is tweetalig (NL/EN).

- **15 AI-tools**: de 14 uit het boek plus één eigen tool (studentwerk beoordelen tegen de rubric
  van de docent). Negen tools werken voor de docent, zes zijn tutors die de docent klaarzet voor
  studenten. Zie [Tools](wiki/Tools.md).
- **BDB/BKE-werkplaats** (`/portfolio`): een beginnende docent bouwt hier het dossier voor de BDB
  en de BKE op, met een coach en export naar Word.
- **Hulpmiddelen zonder AI**: een cijferrekenaar en rubrics bewaren.
- **Privacy**: documenten worden in de browser gelezen en studentgegevens kunnen worden
  geanonimiseerd voordat er iets naar de AI gaat.
- **Beheer**: uitnodigingen, gebruikers, tools, modellen en context per instelling, met een
  superbeheerder.
- **Modellen**: standaard Claude; lokale modellen (Ollama, LM Studio) in ontwikkelmodus.

## Architectuur

React Router 7 (SSR) · TypeScript · Tailwind v4 · SQLite (Drizzle) · AI SDK.

Elke tool is **data**, geen code: een registry-entry met invoervelden en één of meer fasen, plus
een tweetalig promptbestand. Een nieuwe tool toevoegen is dus data toevoegen, test-first. Meer in
de [wiki](wiki/Home.md): [Architectuur](wiki/Architecture.md),
[Een tool toevoegen](wiki/Adding-a-Tool-or-Pack.md). Werkafspraken voor ontwikkelaars en AI-agents
staan in [`AGENTS.md`](AGENTS.md).

## Tests & checks

```bash
npm test && npm run typecheck && npm run check   # de poort: alle drie groen
npm run eval                                     # promptkwaliteit meten (ANTHROPIC_API_KEY nodig)
```

## Roadmap

Richting, geen belofte. De volledige roadmap staat in [wiki/Roadmap.md](wiki/Roadmap.md).

- **Nu:** de acht nieuwe AI-tools, één voor één met een meetbare kwaliteitslat, en rubrics in
  batches invullen.
- **Daarna:** de docentkant eenvoudiger maken, cursussen als rode draad, en het vervolg op de
  BDB/BKE-werkplaats.
- **Later:** rolagenten, de docentweek, praktijksimulaties en spraak.

## Licentie & attributie

De prompts komen uit *The Pedagogical Promptbook* (DOI 10.59668/2340), CC BY 4.0,
en worden met bronvermelding gebruikt en aangepast.
