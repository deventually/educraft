- **Snelle check vóór het reviewteam, gemeten en niet ingebouwd (#370):** we hebben gemeten of
  TypeSafe Jev vóór elke reviewer kan zeggen dat die niets te doen heeft, zodat die reviewer geen
  taalmodel-aanroep kost. Jev sloeg 24 van de 222 reviewers over, en bij 18 daarvan miste de docent
  daardoor advies; het scheelde ongeveer 1 cent per review. Daarom zit de check niet in LimeOnIt:
  elke gekozen reviewer kijkt altijd mee (BESLUIT-2026-11-17-2). De meting, de nieuwe testcursussen
  en het rapport staan in `evals/review-screen/`.
