/** Role agents ("Laat beoordelen", brief P21). */
export const agents = {
  decide: {
    done: "Je besluit is vastgelegd.",
    invalid: "Dit besluit kon niet worden vastgelegd. Controleer je reden (hooguit 500 tekens).",
    notFound: "Dit advies bestaat niet (meer).",
  },
  review: {
    done: "De beoordeling is klaar.",
    failed: "De beoordeling is mislukt. Probeer het later opnieuw.",
    model: "Dit model is niet voor jou beschikbaar. Kies een ander model.",
    partial: "De beoordeling is klaar, maar {agents} gaf geen bruikbaar antwoord.",
    quota: "Je hebt je dagelijkse limiet bereikt. Probeer het morgen opnieuw.",
  },
};
