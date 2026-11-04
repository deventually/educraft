import type { RubricData } from "~/lib/utilities/rubric";

let n = 0;
/** Deterministic v4-shaped UUIDs for fixtures. */
export const uuid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;

export function sampleRubric(): RubricData {
  return {
    criteria: [
      {
        id: uuid(),
        title: "Analyse",
        levels: [
          { id: uuid(), label: "Onvoldoende", points: 0, description: "Geen analyse." },
          { id: uuid(), label: "Voldoende", points: 2, description: "Een analyse." },
          { id: uuid(), label: "Goed", points: 4, description: "Een scherpe analyse." },
        ],
      },
      {
        id: uuid(),
        title: "Bronnen",
        knockout: true,
        levels: [
          { id: uuid(), label: "Ontbreekt", points: 0, description: "" },
          { id: uuid(), label: "Aanwezig", points: 1, description: "APA." },
        ],
      },
    ],
  };
}
