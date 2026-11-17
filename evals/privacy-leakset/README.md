# Lekset anonimiseren

Meet de anonimiseermotor (`app/lib/privacy/redact.ts` met `redactOptions()` uit
`app/lib/privacy/pack/`) zonder model: gewone code, gratis, een seconde.

```bash
npm run eval:leakset -- --label a     # evals/reports/<datum>a-lekset.html
```

- `tuning.json` is de **afstemset**: hierop zijn de regels afgesteld.
- `holdout.json` is de **toetsset**: geschreven vóór de meting en niet gebruikt om regels bij te
  stellen. Wat hier doorglipt, wordt gemeld, niet weggepoetst.
- Elke tekst is verzonnen. `mustGo`: wat weg moet (elke plek; `{ "value", "in" }` toetst een
  waarde alleen in die context). `mustStay`: hele woorden die moeten blijven staan, buiten een
  `mustGo`-waarde.

Het rapport zet bovenaan de woorden die **onterecht vervangen** zijn, daaronder wat **doorglipte**,
en dan alle vervangen woorden met code, aantal, tekst en bedoeling. `tests/evals/leakset.test.ts`
houdt de harde grens vast: geen vakbegrip weg (beide sets) en niets door in de afstemset.
