/**
 * Domain packs — the verified, structured field sets for each hbo domain.
 *
 * This is the seam that keeps the engine neutral: capability grows by adding
 * data here, never by branching control flow. Each pack's option values are
 * lifted verbatim from the domain's authoritative national framework (see
 * `source`/`sourceUrl`). Domains WITHOUT a recognised national taxonomy are
 * deliberately absent — the UI falls back to user-defined custom fields rather
 * than inventing a framework.
 *
 * A profile stores only the chosen values (`ContextProfile.packValues`), keyed
 * by `PackField.key`; labels + options are resolved from here for both the
 * settings UI and the prompt context formatter.
 */
import type { LocalizedText } from "~/lib/i18n/localized";
import type { HboDomain, PackFieldValue } from "./types";

export type PackFieldType = "multiselect" | "single-select" | "level";

export interface PackOption {
  /** Stable, stored value (canonical Dutch term). */
  value: string;
  label: LocalizedText;
}

export interface PackField {
  /** Stable key; used in `packValues` and as the form input name `pack.<key>`. */
  key: string;
  label: LocalizedText;
  type: PackFieldType;
  /** Options for "multiselect" / "single-select". */
  options?: PackOption[];
  /** Highest level for "level" (scale 1..levelMax). */
  levelMax?: number;
  /** Short hint shown under the field. */
  help?: LocalizedText;
}

export interface DomainPack {
  /** Framework name (shown to the user for transparency). */
  source: LocalizedText;
  /** Link to the authoritative source document. */
  sourceUrl?: string;
  fields: PackField[];
}

const LEVEL_1_3_HELP: LocalizedText = {
  nl: "Beheersingsniveau 1–3 (1 = onder begeleiding, 3 = zelfstandig in complexe situaties).",
  en: "Mastery level 1–3 (1 = under guidance, 3 = independent in complex situations).",
};

/**
 * Verified packs per domain. Keys are exactly the `HBO_DOMAINS` values.
 * Domains with no entry have no national taxonomy → custom fields only.
 */
export const DOMAIN_PACKS: Partial<Record<HboDomain, DomainPack>> = {
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

  // Agro, voeding & leefomgeving + Overig: no national taxonomy → custom fields only.
};

/** The pack for a domain, or undefined if the domain has no structured framework. */
export function getDomainPack(domain: string | undefined | null): DomainPack | undefined {
  if (!domain) return undefined;
  return DOMAIN_PACKS[domain as HboDomain];
}

/** A pack field by key within a domain (for parsing/formatting lookups). */
export function getPackField(domain: string | undefined, key: string): PackField | undefined {
  return getDomainPack(domain)?.fields.find((f) => f.key === key);
}

/**
 * A suggested mastery level for a 4-year hbo bachelor by study year. The
 * frameworks (hbo-i, HBO Engineering) define the TOP level (`levelMax`, here 3)
 * as the bachelor graduation ceiling and treat the propedeuse as the entry
 * level; the middle years build toward it. OERs publish only the propedeuse and
 * graduation milestones, so the year-2/3 placement is a transparent
 * interpolation, not a single cited figure — and the user can change it.
 * Returns undefined when no year is chosen (then nothing is prefilled).
 */
export function levelForYear(year: number | undefined, levelMax: number): number | undefined {
  if (!year) return undefined;
  const byYear: Record<number, number> = { 1: 1, 2: 2, 3: 2, 4: levelMax };
  const lvl = byYear[year];
  return lvl == null ? undefined : Math.min(lvl, levelMax);
}

/**
 * Factual default answers for a domain's pack, used to PRE-FILL the create form:
 * - multiselect dimensions → the full framework (every option), since the source
 *   defines these as the domain's complete competence set; the user deselects
 *   what their programme doesn't emphasise (selecting a subset would be a guess).
 * - level → `levelForYear` once a study year is chosen (refines further by year).
 * - single-select → left unset (no factual default among the alternatives).
 */
export function defaultPackValues(
  domain: string | undefined,
  studyYear?: number,
): Record<string, PackFieldValue> {
  const pack = getDomainPack(domain);
  if (!pack) return {};
  const out: Record<string, PackFieldValue> = {};
  for (const field of pack.fields) {
    if (field.type === "multiselect") {
      out[field.key] = (field.options ?? []).map((o) => o.value);
    } else if (field.type === "level") {
      const lvl = levelForYear(studyYear, field.levelMax ?? 3);
      if (lvl != null) out[field.key] = lvl;
    }
  }
  return out;
}
