/**
 * The wo sector pack: the Dublin descriptors. wo has no national professional
 * framework like hbo-i; the Dublin descriptors (Joint Quality Initiative, 2004)
 * are the shared end-qualification frame of the Bologna qualifications framework,
 * against which the NVAO assesses every programme's eindtermen. They hold for
 * every wo domain, so `frameworks.ts` uses this pack as the sector fallback. The
 * cycle (bachelor, master, doctorate) comes from the profile's track, so the pack
 * carries no level field.
 */
import type { DomainPack } from "./packs";

export const DUBLIN_PACK: DomainPack = {
  source: {
    nl: "Dublin-descriptoren (Joint Quality Initiative, 2004)",
    en: "Dublin descriptors (Joint Quality Initiative, 2004)",
  },
  sourceUrl: "https://www.aqu.cat/doc/doc_24496811_1.pdf",
  fields: [
    {
      key: "dublinDescriptoren",
      label: { nl: "Dublin-descriptoren", en: "Dublin descriptors" },
      type: "multiselect",
      options: [
        {
          value: "Kennis en inzicht",
          label: { nl: "Kennis en inzicht", en: "Knowledge and understanding" },
        },
        {
          value: "Toepassen van kennis en inzicht",
          label: {
            nl: "Toepassen van kennis en inzicht",
            en: "Applying knowledge and understanding",
          },
        },
        { value: "Oordeelsvorming", label: { nl: "Oordeelsvorming", en: "Making judgements" } },
        { value: "Communicatie", label: { nl: "Communicatie", en: "Communication" } },
        { value: "Leervaardigheden", label: { nl: "Leervaardigheden", en: "Learning skills" } },
      ],
      help: {
        nl: "Het niveau (bachelor, master of promotie) volgt uit het onderwijstype.",
        en: "The level (bachelor, master or doctorate) follows from the type of education.",
      },
    },
  ],
};
