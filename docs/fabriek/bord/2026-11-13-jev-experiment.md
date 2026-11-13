- **Experiment: Jev sorteert bewijs (eval, #336):** de eval van *Bewijs in één keer* kan nu ook TypeSafe
  Jev meten, een klein beslismodel dat kiest en ja/nee zegt met een kans erbij, via OpenRouter.
  Dezelfde cases, dezelfde checks, plus snelheid en kosten, zodat Bastiaan Jev naast het huidige
  taalmodel kan leggen. Voor docenten verandert er niets: de app roept Jev nog niet aan.
- **Jev eerlijk gemeten (v3, #336):** de vragen aan Jev volgen nu TypeSafe's eigen advies helemaal,
  niet half. De skill van TypeSafe staat aan in de projectinstellingen, zodat elke sessie hem heeft
  en updates meekrijgt. Er is een holdout van tien echte, geanonimiseerde dossierstukken om te zien
  of het resultaat standhoudt; die blijft op de Mac van Bastiaan en komt niet in de publieke repo.
