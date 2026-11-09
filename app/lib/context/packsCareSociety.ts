/**
 * Verified domain packs for Zorg & welzijn, Onderwijs, Sociale studies, Recht
 * and Kunst & creatief. Composed into `DOMAIN_PACKS` (`./packs`); see there for
 * the rules a pack follows.
 */
import type { DomainPack } from "./packs";
import type { HboDomain } from "./types";

export const CARE_SOCIETY_PACKS: Partial<Record<HboDomain, DomainPack>> = {
  // --- Zorg & welzijn — Bachelor Nursing 2020 (CanMEDS) ---------------------
  "Zorg & welzijn": {
    source: {
      nl: "Bachelor Nursing 2020 (CanMEDS-rollen)",
      en: "Bachelor Nursing 2020 (CanMEDS roles)",
    },
    sourceUrl:
      "https://www.vereniginghogescholen.nl/system/profiles/documents/000/000/180/original/Bachelor_of_Nursing_2020_-_Toekomstbestendig_opleidingsprofiel_4.0.pdf",
    fields: [
      {
        key: "canmedsRollen",
        label: { nl: "CanMEDS-rollen (BN2020)", en: "CanMEDS roles (BN2020)" },
        type: "multiselect",
        help: {
          nl: "Verpleegkundig opleidingsprofiel. Sociaal werk valt onder het domein 'Sociale studies'.",
          en: "Nursing profile. Social work is covered by the 'Sociale studies' domain.",
        },
        options: [
          { value: "Zorgverlener", label: { nl: "Zorgverlener", en: "Care provider" } },
          { value: "Communicator", label: { nl: "Communicator", en: "Communicator" } },
          {
            value: "Samenwerkingspartner",
            label: { nl: "Samenwerkingspartner", en: "Collaboration partner" },
          },
          {
            value: "Reflectieve EBP-professional",
            label: { nl: "Reflectieve EBP-professional", en: "Reflective EBP professional" },
          },
          {
            value: "Gezondheidsbevorderaar",
            label: { nl: "Gezondheidsbevorderaar", en: "Health promoter" },
          },
          { value: "Organisator", label: { nl: "Organisator", en: "Organiser" } },
          {
            value: "Professional en kwaliteitsbevorderaar",
            label: {
              nl: "Professional en kwaliteitsbevorderaar",
              en: "Professional & quality promoter",
            },
          },
        ],
      },
    ],
  },

  // --- Onderwijs — bekwaamheidseisen (wet BIO) + generieke kennisbasis ------
  Onderwijs: {
    source: {
      nl: "Bekwaamheidseisen (wet BIO) + generieke kennisbasis",
      en: "Teacher competence requirements (BIO Act) + generic knowledge base",
    },
    sourceUrl:
      "https://www.rijksoverheid.nl/onderwerpen/werken-in-het-onderwijs/bekwaamheidseisen-leraren",
    fields: [
      {
        key: "bekwaamheid",
        label: { nl: "Bekwaamheid (wet BIO)", en: "Competence area (BIO Act)" },
        type: "multiselect",
        options: [
          { value: "Vakinhoudelijk", label: { nl: "Vakinhoudelijk", en: "Subject-matter" } },
          { value: "Vakdidactisch", label: { nl: "Vakdidactisch", en: "Subject-didactic" } },
          { value: "Pedagogisch", label: { nl: "Pedagogisch", en: "Pedagogical" } },
        ],
      },
      {
        key: "kennisbasisDomein",
        label: { nl: "Domein generieke kennisbasis", en: "Generic knowledge-base domain" },
        type: "multiselect",
        options: [
          {
            value: "Pedagogisch handelen",
            label: { nl: "Pedagogisch handelen", en: "Pedagogical practice" },
          },
          {
            value: "Didactisch handelen",
            label: { nl: "Didactisch handelen", en: "Didactic practice" },
          },
          {
            value: "Onderzoekend handelen",
            label: { nl: "Onderzoekend handelen", en: "Inquiry-based practice" },
          },
          {
            value: "Professionele identiteit",
            label: { nl: "Professionele identiteit", en: "Professional identity" },
          },
        ],
      },
      {
        key: "typeLerarenopleiding",
        label: {
          nl: "Type lerarenopleiding / bevoegdheid",
          en: "Teacher-education programme / qualification",
        },
        type: "single-select",
        options: [
          {
            value: "Pabo",
            label: { nl: "Pabo (primair onderwijs)", en: "Pabo (primary education)" },
          },
          {
            value: "Tweedegraads",
            label: {
              nl: "Tweedegraads (vmbo, onderbouw, mbo)",
              en: "Second-degree (lower secondary, mbo)",
            },
          },
          {
            value: "Eerstegraads",
            label: {
              nl: "Eerstegraads (bovenbouw havo/vwo)",
              en: "First-degree (upper secondary)",
            },
          },
          {
            value: "Ongegradeerd",
            label: { nl: "Ongegradeerd (bijv. LO, kunstvakken)", en: "Ungraded (e.g. PE, arts)" },
          },
        ],
      },
    ],
  },

  // --- Sociale studies — Landelijk Opleidingsdocument Sociaal Werk (2017) ---
  "Sociale studies": {
    source: {
      nl: "Landelijk Opleidingsdocument Sociaal Werk (2017)",
      en: "National Social Work education document (2017)",
    },
    sourceUrl:
      "https://www.vereniginghogescholen.nl/system/profiles/documents/000/000/373/original/Landelijk_opleidingsdocument_Social_Work.pdf",
    fields: [
      {
        key: "kerntaken",
        label: { nl: "Kerntaken sociaal werk", en: "Core tasks (social work)" },
        type: "multiselect",
        options: [
          {
            value: "Sociaal functioneren bevorderen",
            label: {
              nl: "Bevorderen van het sociaal functioneren van mensen en hun sociale context",
              en: "Promoting people's social functioning and their social context",
            },
          },
          {
            value: "Organisatorische verbanden versterken",
            label: {
              nl: "Versterken van de organisatorische verbanden waarbinnen sociaal werk plaatsvindt",
              en: "Strengthening the organisational structures in which social work takes place",
            },
          },
          {
            value: "Professionaliteit bevorderen",
            label: {
              nl: "Bevorderen van de eigen professionaliteit en de ontwikkeling van het beroep",
              en: "Advancing one's own professionalism and the development of the profession",
            },
          },
        ],
      },
      {
        key: "uitstroomprofiel",
        label: { nl: "Uitstroomprofiel sociaal werk", en: "Social work exit profile" },
        type: "single-select",
        options: [
          {
            value: "Welzijn en samenleving",
            label: {
              nl: "Sociaal werk – welzijn en samenleving",
              en: "Social work – welfare & society",
            },
          },
          { value: "Zorg", label: { nl: "Sociaal werk – zorg", en: "Social work – care" } },
          { value: "Jeugd", label: { nl: "Sociaal werk – jeugd", en: "Social work – youth" } },
        ],
      },
    ],
  },

  // --- Recht — Landelijk beroeps- en opleidingsprofiel HBO-Rechten (2025) ---
  Recht: {
    source: {
      nl: "Landelijk beroeps- en opleidingsprofiel HBO-Rechten (2025)",
      en: "National professional & education profile HBO-Rechten (2025)",
    },
    sourceUrl:
      "https://www.vereniginghogescholen.nl/system/profiles/documents/000/000/347/original/LBOP_Hbo_Rechten.pdf",
    fields: [
      {
        key: "leeruitkomsten",
        label: { nl: "Leeruitkomsten HBO-Rechten", en: "HBO-Rechten learning outcomes" },
        type: "multiselect",
        options: [
          {
            value: "Juridisch analyseren",
            label: { nl: "Juridisch analyseren", en: "Legal analysis" },
          },
          { value: "Adviseren", label: { nl: "Adviseren", en: "Advising" } },
          {
            value: "Belangen behartigen",
            label: { nl: "Belangen behartigen", en: "Representing interests" },
          },
          { value: "Beslissen", label: { nl: "Beslissen", en: "Deciding" } },
          { value: "Digitaliseren", label: { nl: "Digitaliseren", en: "Digitalising" } },
          {
            value: "Professioneel handelen",
            label: { nl: "Professioneel handelen", en: "Professional conduct" },
          },
        ],
      },
      {
        key: "rechtsgebied",
        label: { nl: "Rechtsgebied", en: "Area of law" },
        type: "multiselect",
        options: [
          {
            value: "Staats- en bestuursrecht",
            label: { nl: "Staats- en bestuursrecht", en: "Constitutional & administrative law" },
          },
          { value: "Privaatrecht", label: { nl: "Privaatrecht", en: "Private law" } },
          { value: "Strafrecht", label: { nl: "Strafrecht", en: "Criminal law" } },
          {
            value: "Internationaal en Europees recht",
            label: { nl: "Internationaal en Europees recht", en: "International & European law" },
          },
          { value: "Mensenrechten", label: { nl: "Mensenrechten", en: "Human rights" } },
        ],
      },
    ],
  },

  // --- Kunst & creatief — Beroeps- en opleidingsprofiel Beeldende kunst & design (2025)
  "Kunst & creatief": {
    source: {
      nl: "Beeldende kunst & design — beroeps- en opleidingsprofiel (2025)",
      en: "Visual arts & design — professional & education profile (2025)",
    },
    sourceUrl: "https://www.vereniginghogescholen.nl/profielenbank/b-beeldende-kunst-en-vormgeving",
    fields: [
      {
        key: "kerncompetenties",
        label: { nl: "Kerncompetenties", en: "Core competencies" },
        type: "multiselect",
        help: {
          nl: "Voor CMD, muziek, theater of dans gelden eigen profielen — gebruik daarvoor eigen velden.",
          en: "CMD, music, theatre and dance have their own profiles — use custom fields for those.",
        },
        options: [
          {
            value: "Artistiek creëren",
            label: { nl: "Artistiek creëren", en: "Artistic creation" },
          },
          {
            value: "Onderzoeken en reflecteren",
            label: { nl: "Onderzoeken en reflecteren", en: "Researching & reflecting" },
          },
          {
            value: "Verbinden met de omgeving",
            label: { nl: "Verbinden met de omgeving", en: "Connecting with the environment" },
          },
          {
            value: "Werken in een praktijk",
            label: { nl: "Werken in een praktijk", en: "Working in a practice" },
          },
        ],
      },
    ],
  },
};
