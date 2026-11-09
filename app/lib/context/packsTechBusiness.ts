/**
 * Verified domain packs for ICT, Techniek and Economie & management. Composed
 * into `DOMAIN_PACKS` (`./packs`); see there for the rules a pack follows.
 */
import type { LocalizedText } from "~/lib/i18n/localized";
import type { DomainPack } from "./packs";
import type { HboDomain } from "./types";

const LEVEL_1_3_HELP: LocalizedText = {
  nl: "Beheersingsniveau 1–3 (1 = onder begeleiding, 3 = zelfstandig in complexe situaties).",
  en: "Mastery level 1–3 (1 = under guidance, 3 = independent in complex situations).",
};

export const TECH_BUSINESS_PACKS: Partial<Record<HboDomain, DomainPack>> = {
  // --- ICT — hbo-i domeinbeschrijving --------------------------------------
  ICT: {
    source: { nl: "hbo-i domeinbeschrijving", en: "hbo-i domain description" },
    sourceUrl: "https://www.hbo-i.nl/domeinbeschrijving/",
    fields: [
      {
        key: "architectuurlagen",
        label: { nl: "Architectuurlagen", en: "Architecture layers" },
        type: "multiselect",
        options: [
          {
            value: "Gebruikersinteractie",
            label: { nl: "Gebruikersinteractie", en: "User interaction" },
          },
          {
            value: "Organisatieprocessen",
            label: { nl: "Organisatieprocessen", en: "Business processes" },
          },
          { value: "Infrastructuur", label: { nl: "Infrastructuur", en: "Infrastructure" } },
          { value: "Software", label: { nl: "Software", en: "Software" } },
          {
            value: "Hardware-interfacing",
            label: { nl: "Hardware-interfacing", en: "Hardware interfacing" },
          },
        ],
      },
      {
        key: "activiteiten",
        label: { nl: "Beroepsactiviteiten", en: "Professional activities" },
        type: "multiselect",
        options: [
          { value: "Analyseren", label: { nl: "Analyseren", en: "Analysis" } },
          { value: "Adviseren", label: { nl: "Adviseren", en: "Advice" } },
          { value: "Ontwerpen", label: { nl: "Ontwerpen", en: "Design" } },
          { value: "Realiseren", label: { nl: "Realiseren", en: "Realisation" } },
          { value: "Beheren", label: { nl: "Beheren", en: "Management" } },
        ],
      },
      {
        key: "beheersingsniveau",
        label: { nl: "Beheersingsniveau", en: "Proficiency level" },
        type: "level",
        levelMax: 3,
        help: LEVEL_1_3_HELP,
      },
    ],
  },

  // --- Techniek — Domeinbeschrijving HBO Engineering (2022) -----------------
  Techniek: {
    source: {
      nl: "Domeinbeschrijving HBO Engineering (2022)",
      en: "HBO Engineering domain description (2022)",
    },
    sourceUrl: "https://www.hbo-engineering.nl/domeinprofiel",
    fields: [
      {
        key: "domeincompetenties",
        label: {
          nl: "Domeincompetenties / beroepstaken",
          en: "Domain competencies / professional tasks",
        },
        type: "multiselect",
        options: [
          { value: "Analyseren", label: { nl: "Analyseren", en: "Analysing" } },
          { value: "Ontwerpen", label: { nl: "Ontwerpen", en: "Designing" } },
          { value: "Realiseren", label: { nl: "Realiseren", en: "Realising" } },
          { value: "Beheren", label: { nl: "Beheren", en: "Managing & maintaining" } },
          { value: "Managen", label: { nl: "Managen", en: "Managing" } },
          { value: "Adviseren", label: { nl: "Adviseren", en: "Advising" } },
          { value: "Onderzoeken", label: { nl: "Onderzoeken", en: "Researching" } },
          {
            value: "Professionaliseren",
            label: { nl: "Professionaliseren", en: "Professionalising" },
          },
        ],
      },
      {
        key: "toepassingsgebied",
        label: { nl: "Toepassingsgebied", en: "Application area" },
        type: "multiselect",
        options: [
          { value: "Product", label: { nl: "Product", en: "Product" } },
          { value: "Systeem", label: { nl: "Systeem", en: "System" } },
          { value: "Proces", label: { nl: "Proces", en: "Process" } },
          { value: "Methode", label: { nl: "Methode", en: "Method" } },
        ],
      },
      {
        key: "beheersingsniveau",
        label: { nl: "Beheersingsniveau", en: "Mastery level" },
        type: "level",
        levelMax: 3,
        help: LEVEL_1_3_HELP,
      },
    ],
  },

  // --- Economie & management — Sectorplan HEO 2023–2027 ---------------------
  "Economie & management": {
    source: { nl: "Sectorplan HEO 2023–2027", en: "HEO sector plan 2023–2027" },
    sourceUrl: "https://www.vereniginghogescholen.nl/sectoren/economie",
    fields: [
      {
        key: "heoDomein",
        label: { nl: "HEO-domein", en: "HEO domain" },
        type: "single-select",
        help: {
          nl: "Een domein is een ordening van opleidingen, geen inhoudelijke categorie.",
          en: "A domain is an organisation of programmes, not a content category.",
        },
        options: [
          {
            value: "Commerce & Creative",
            label: { nl: "Commerce & Creative", en: "Commerce & Creative" },
          },
          { value: "Communicatie", label: { nl: "Communicatie", en: "Communication" } },
          { value: "Finance", label: { nl: "Finance", en: "Finance" } },
          { value: "Management", label: { nl: "Management", en: "Management" } },
          {
            value: "Rechten & Governance",
            label: { nl: "Rechten & Governance", en: "Law & Governance" },
          },
          { value: "Hospitality", label: { nl: "Hospitality", en: "Hospitality" } },
        ],
      },
      {
        key: "kerngebieden",
        label: { nl: "Kerngebieden (HEO-standaard)", en: "Core areas (HEO standard)" },
        type: "multiselect",
        help: {
          nl: "Specifieke leeruitkomsten verschillen per opleiding — gebruik daarvoor eigen velden.",
          en: "Specific learning outcomes differ per programme — use custom fields for those.",
        },
        options: [
          {
            value: "Gedegen theoretische basis",
            label: { nl: "Gedegen theoretische basis", en: "Solid theoretical base" },
          },
          {
            value: "Onderzoekend vermogen",
            label: { nl: "Onderzoekend vermogen", en: "Research capability" },
          },
          {
            value: "Professioneel vakmanschap",
            label: { nl: "Professioneel vakmanschap", en: "Professional craftsmanship" },
          },
          {
            value: "Beroepsethiek en maatschappelijke oriëntatie",
            label: {
              nl: "Beroepsethiek en maatschappelijke oriëntatie",
              en: "Professional ethics & societal orientation",
            },
          },
        ],
      },
    ],
  },
};
