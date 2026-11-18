- **Audit-check weer groen, met een uitzondering die afloopt:** een nieuw beveiligingsadvies in
  picomatch (alleen gebruikt door ontwikkelgereedschap, nog geen oplossing) maakte de verplichte
  check `audit` rood. Het advies staat nu met reden en einddatum (31 december) op
  `config/audit-exceptions.json`; daarna is de check weer rood als er nog geen oplossing is. De
  app zelf krijgt nooit een uitzondering (BESLUIT-2026-11-17-7).
