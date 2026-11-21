# Fabrieksbord

> Het bord van de Producer: verzoeken, wat op jou wacht, wat volgt. Kort houden: dit is een bord,
> geen archief.
>
> - **Wat er gemerged is:** de map [`bord/`](bord/), één bestand per PR (nieuwste datum onderaan
>   in de map). Een PR zet daar zijn eigen nieuwe bestand neer en schrijft hier niets voor zijn
>   eigen werk (BESLUIT-2026-11-12-16).
> - **Wat loopt:** de [open PR's](https://github.com/deventually/educraft/pulls). Wil je werk
>   claimen voordat het af is, open dan vroeg een concept-PR.
> - **Hier** komt alleen een wijziging die over deze lijsten zelf gaat: een nieuw verzoek, iets
>   dat op Bastiaan wacht, de volgorde, een open vraag.

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

## Wacht op jou

- Niets.

## Volgende

Stand 2026-11-21: alles wat vóór de pilot gepland stond, is gemerged (laatste PR #390); de status
van de briefs P30–P39 is bijgewerkt. Gekozen door Bastiaan, 2026-11-21:

1. **De eerste release** met `/release`; de tag zet Bastiaan zelf.

Daarna, pas na de pilot (BESLUIT-2026-11-06-5, -10-1, -12-10), tenzij Bastiaan iets naar voren haalt:

- **P30.5–30.8:** Brightspace (toetsvragen en cijfers), onderzoek naar GradeWork, huisstijl als
  instellingen en Word-sjablonen, documentatie.
- **P32:** de reviewer Examencommissie en meekijkers.
- **P37:** lesbezoek met kijkwijzer, na meekijken met een account (P32.4).
- **feedforward@v3** (P39.3), alleen als er in de pilot een naam terugkomt.

## Open vragen

- De privacy-officer kijkt later mee naar het anonimiseren (24.0b, BESLUIT-2026-11-04-20).
- De privacy-officer kijkt later mee naar het rubric-invullen in batches (P23.3, BESLUIT-2026-11-04-8).
- **Voor de privacy-officer:** de bewaartermijn en een aanvulling op de DPIA voor het stage- en
  afstudeertraject (P38, BESLUIT-2026-11-12-11). Het onderdeel staat aan; een beheerder kan het
  tot het akkoord uitzetten (BESLUIT-2026-11-12-15).

## Later (bewust geparkeerd)

- **Examencommissie** (aparte flow over meerdere cursussen), na de pilot, bouwt op opleidingen en
  leerlijnen.
- Add-on **praktijksimulaties** (Webshop Bob, fotorealistische avatars).
- Spraak (dicteren, voorlezen).
- De studentenlaag, opnieuw en beter.
- Het evaluatie-harnas: de nulmeting is nog nooit gedraaid.
