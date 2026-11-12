# Fase 37 — Lesbezoek met kijkwijzer: een collega observeert, het verslag wordt BDB-bewijs

> **Status:** ⚪ brief. **Wacht op meekijken met een account (P32.4)**, dat nu na de pilot staat
> (BESLUIT-2026-11-12-10). Zo voer je deze brief uit: één deelstap per sessie, elke deelstap één PR
> vanaf `main`, test-first volgens `AGENTS.md` / de `/tdd`-skill, poort
> `npm test && npm run typecheck && npm run check`. Merge nooit zelf; alleen Bastiaan merget.
> Volgorde en gedeelde bestanden: `README.md`, *Docenthulpjes*.

## In gewone taal

Voor de BDB moet een beginnende docent laten zien hoe hij lesgeeft, en daar horen lesbezoeken bij.
Nu is dat handwerk: een collega neemt een papieren kijkwijzer mee, schrijft er iets op, en de docent
typt het over in zijn dossier. In LimeOnIt kiest de docent bij een les uit zijn cursus *Vraag een
lesbezoek*, met een kijkwijzer. Een collega die mag meekijken (P32.4) ziet de lesopzet, vult de
kijkwijzer in en schrijft wat hem opviel. Het verslag komt als bewijs in het BDB/BKE-dossier, bij de
leeruitkomst *Doceren*.

Herkomst: onderzoek "Docenttaken en hulpjes in LimeOnIt", hulpje 5.

## Vaste uitgangspunten

1. **Geen studentgegevens.** De kijkwijzer gaat over de docent en de les; de tekstvakken zeggen
   "geen namen van studenten", en de namencheck draait vóór opslaan.
2. **De kijkwijzer is data, en nooit verzonnen** (BESLUIT-2026-05-31-1). Een kijkwijzer komt uit het
   BDB-kader van de eigen hogeschool (de ankers die de werkplaats al kent, P25.4) of de docent maakt
   hem zelf. Een standaardkijkwijzer alleen met een bron die we hebben gecontroleerd.
3. **De collega schrijft, de docent kiest.** Wat de collega invult, is van de collega en wordt niet
   veranderd. De docent kiest of het verslag bewijs wordt; dan gaat het als momentopname mee
   (P26.4), met de rol van de collega en, alleen als de collega dat aanvinkt, zijn naam.
4. **Meekijken gaat via P32.** Lezen door een ander alleen via `shares.server.ts` en `view_grants`;
   schrijven door een meekijker alleen in zijn eigen rij, zoals de adviezen van meekijkers (P32.7).

## Deelstappen

### 37.1 — Kijkwijzer en verzoek (pure helft + opslag, migratie)

- `app/lib/observations/`: het schema van een kijkwijzer (criteria met een korte omschrijving en een
  schaal, of alleen open vragen), en een kijkwijzer afleiden uit de ankers van het dossier
  (`app/lib/portfolio/anchors.ts`).
- Tabel `lesson_observations` (eigen schemabestand, zoals `schemaCourseMembers.server.ts`): `id`,
  `ownerId`, `courseId`, `activityId`, `grantId`, `guideJson`, `answersJson`, `observerShowsName`,
  `status`, `createdAt`, `completedAt`. Repository `app/server/repositories/observations.server.ts`:
  de eigenaar leest en verwijdert; de meekijker met een geldige grant schrijft alleen zijn
  antwoorden.
- **RED:** scope (een ander leest niets; een verlopen grant schrijft niet); de namencheck.

### 37.2 — Het scherm voor docent en collega

- Bij een les in de cursus (tabblad *Lessen*): *Vraag een lesbezoek*, met de kijkwijzer en de
  uitnodiging (P32.4). De collega ziet onder *Meekijken* de lesopzet en het formulier.
- **RED:** componenten met axe; een `/accessibility-review` van het formulier van de collega.

### 37.3 — Als BDB-bewijs, en een verslag uit steekwoorden (optioneel AI)

- *Gebruik als bewijs*: het ingevulde verslag als momentopname in het dossier, voorgesteld bij
  *Doceren* (`suggestEvidence`).
- Optioneel: de collega typt steekwoorden en LimeOnIt maakt er een leesbaar verslag van
  (`observation-report@v1`), alleen met wat er in de steekwoorden staat. Evals met twee bekende
  fouten (een verzonnen observatie, een oordeel dat niet in de steekwoorden staat).

## Volgorde

P32.4 ──▶ `37.1 ──▶ 37.2 ──▶ 37.3`.

## Buiten deze fase

- Video van de les.
- Lesbezoek door een student of een stagebegeleider zonder account (dat is de leeslink van P32.5,
  en die is alleen lezen).
