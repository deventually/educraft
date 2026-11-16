- **Ontwikkelserver herlaadt niet meer midden in het werk:** `npm run dev` bundelt bij het starten
  de pakketten van alle pagina's vooraf. Voorheen deed hij dat pas bij het eerste bezoek aan een
  pagina (zoals een cursus) en herlaadde hij dan. Een open tabblad kreeg daarna "504 Outdated
  Optimize Dep" en knoppen als verwijderen en uploaden deden niets meer. Voor een docent op de
  echte app verandert er niets.
