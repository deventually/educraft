- **De evals-map opgeruimd:** `evals/reports/` gaat van 242 naar 111 bestanden en van 43 naar
  14 MB. Oude tussenrondes waar niemand meer naar verwijst en de ruwe json-bestanden van
  afgeronde metingen (judge-jev versie 1 en 2, bloom-jev, bloom-check, review-screen) zijn weg; de
  map `evals/reviews/` met per ongeluk gecommitte modeluitvoer ook. Wat blijft: elk rapport dat
  ergens genoemd wordt, de scores die de volgende eval-run voor "Δ vs prev" nodig heeft, de
  laatste meting van elke eval, en de ruwe sets van Jev als judge versie 4. Alles is terug te
  halen uit de git-geschiedenis; een test bewaakt de regels. Voor een docent verandert er niets.
