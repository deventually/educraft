- **Jev controleert dekking en soort toets bij de import (#367, alleen met Jev's schakelaar in Beheer aan):**
  importeert een docent een cursusdocument, dan leest Jev per toets het stuk van het document waar
  die toets staat en kijkt of de AI goed las welke leeruitkomsten de toets dekt en of hij formatief
  of summatief is. Twijfelt Jev, of leest het iets anders, dan staat er "Controleer" bij dat vinkje
  of die soort. Jev zet zelf geen vinkjes om; de docent beslist. Er is een meetopzet
  (`npm run eval:coverage-jev`); de eerste meting moet nog draaien.
