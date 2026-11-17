/**
 * The one fixed sentence the server gate adds to a prompt it replaced something in
 * (anonymiseerpoort, PR 2): codes are people and details, keep them as they are, so the answer
 * stays coherent and the names can be put back.
 */
export const CODE_NOTE: Readonly<Record<"nl" | "en", string>> = {
  nl: "Woorden tussen blokhaken, zoals [DOCENT], [COLLEGA-1] of [E-MAIL-1], staan voor echte personen en gegevens die zijn weggelaten. Behandel ze als personen en gegevens, schrijf ze precies zo over waar je ze nodig hebt en vraag niet wie het zijn.",
  en: "Words in square brackets, such as [DOCENT], [COLLEGA-1] or [E-MAIL-1], stand for real people and details that were left out. Treat them as people and details, copy them exactly as written where you need them, and do not ask who they are.",
};
