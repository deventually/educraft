/**
 * mbo packs per kwalificatie (BESLUIT-2026-11-10-4). The mbo "vakgebied" is the
 * kwalificatie (crebo); its pack lists the kerntaken and werkprocessen of the SBB
 * kwalificatiedossier, verbatim with their codes (the role tags such as
 * "(Zorgverlener)" are left off). There is no level field: the mbo level of the
 * kwalificatie is the level, and the profile already carries it. The English
 * labels are our translation; the Dutch text is the source. Each kwalificatie is
 * offered in the picker under its opleidingsdomein (`domains.ts`), so a
 * kwalificatie only appears once it has a pack here.
 *
 * Proef (PR 2): the largest kwalificatie per level by DUO enrolment 2025 (levels
 * 2, 3 and 4, all in Zorg en welzijn) plus Software developer as a technical one.
 */
import type { LocalizedText } from "~/lib/i18n/localized";
import type { DomainPack, PackOption } from "./packs";

/** One mbo kwalificatie with its pack; `opleidingsdomein` is its slug in `domains.ts`. */
interface MboQualification {
  value: string;
  label: LocalizedText;
  opleidingsdomein: string;
  pack: DomainPack;
}

type Item = [code: string, nl: string, en: string];

const options = (items: Item[]): PackOption[] =>
  items.map(([code, nl, en]) => ({
    value: `${code}: ${nl}`,
    label: { nl: `${code}: ${nl}`, en: `${code}: ${en}` },
  }));

function mboPack(
  source: LocalizedText,
  sourceUrl: string,
  kerntaken: Item[],
  werkprocessen: Item[],
): DomainPack {
  return {
    source,
    sourceUrl,
    fields: [
      {
        key: "kerntaken",
        label: { nl: "Kerntaken", en: "Core tasks (kerntaken)" },
        type: "multiselect",
        options: options(kerntaken),
      },
      {
        key: "werkprocessen",
        label: { nl: "Werkprocessen", en: "Work processes (werkprocessen)" },
        type: "multiselect",
        options: options(werkprocessen),
        help: {
          nl: "De werkprocessen zijn de beroepsactiviteiten uit het kwalificatiedossier.",
          en: "The work processes are the professional activities from the qualification file.",
        },
      },
    ],
  };
}

const SBB_VERZORGING_VERPLEGING =
  "https://www.mboraad.nl/sites/default/files/2026-05/BoK%20KD%20Verzorging%20en%20verpleging.pdf";

/** Basisdeel of Verzorging en verpleging (23453), shared by Verzorgende IG and Mbo-Verpleegkundige. */
const VV_KERNTAKEN: Item[] = [
  ["B1-K1", "Biedt zorg, ondersteuning en begeleiding", "Provides care, support and guidance"],
  ["B1-K2", "Stemt de zorg en ondersteuning af", "Coordinates care and support"],
  ["B1-K3", "Draagt bij aan kwaliteit van zorg", "Contributes to quality of care"],
];
const VV_WERKPROCESSEN: Item[] = [
  [
    "B1-K1-W1",
    "Inventariseert de behoefte aan zorg en/of ondersteuning",
    "Identifies the need for care and/or support",
  ],
  ["B1-K1-W2", "Stelt het zorgplan op en/of bij", "Draws up and/or adjusts the care plan"],
  [
    "B1-K1-W3",
    "Voert zorginterventies en/of begeleidingsactiviteiten uit",
    "Carries out care interventions and/or guidance activities",
  ],
  ["B1-K1-W4", "Voert verpleegtechnische handelingen uit", "Performs technical nursing procedures"],
  [
    "B1-K1-W5",
    "Handelt in onvoorziene en/of acute situaties",
    "Acts in unforeseen and/or acute situations",
  ],
  [
    "B1-K1-W6",
    "Geeft informatie en advies over zorg en gezondheid",
    "Gives information and advice on care and health",
  ],
  ["B1-K2-W1", "Stemt af met informele zorgverleners", "Coordinates with informal carers"],
  ["B1-K2-W2", "Werkt samen met andere zorgprofessionals", "Works with other care professionals"],
  ["B1-K3-W1", "Draagt bij aan het innoveren van zorg", "Contributes to innovation in care"],
  [
    "B1-K3-W2",
    "Evalueert de werkzaamheden en ontwikkelt zichzelf als professional",
    "Evaluates the work and develops as a professional",
  ],
  [
    "B1-K3-W3",
    "Draagt bij aan een sociaal en fysiek veilige werkomgeving",
    "Contributes to a socially and physically safe work environment",
  ],
];

export const MBO_QUALIFICATIONS: MboQualification[] = [
  {
    value: "mbo-kw-25960",
    label: {
      nl: "Helpende Zorg en Welzijn (niveau 2, crebo 25960)",
      en: "Care and welfare assistant (level 2, crebo 25960)",
    },
    opleidingsdomein: "mbo-zorg-welzijn",
    pack: mboPack(
      {
        nl: "Kwalificatiedossier Dienstverlening (crebo 23385), kwalificatie Helpende Zorg en Welzijn (crebo 25960), geldig vanaf 1-8-2024",
        en: "Qualification file Dienstverlening (crebo 23385), qualification Helpende Zorg en Welzijn (crebo 25960), valid from 1-8-2024",
      },
      "https://kwalificatie-mijn.s-bb.nl/Details/DownloadDocument/1911458",
      [
        ["B1-K1", "Voert dienstverlenende werkzaamheden uit", "Carries out service tasks"],
        [
          "P2-K1",
          "Ondersteunt bij dagelijkse activiteiten in zorg en welzijn",
          "Supports daily activities in care and welfare",
        ],
      ],
      [
        ["B1-K1-W1", "Bereidt werkzaamheden voor en stemt af", "Prepares and coordinates the work"],
        [
          "B1-K1-W2",
          "Treedt op als online en/of offline aanspreekpunt",
          "Acts as an online and/or offline point of contact",
        ],
        [
          "B1-K1-W3",
          "Draagt bij aan een fysiek en sociaal veilige werkomgeving",
          "Contributes to a physically and socially safe work environment",
        ],
        ["B1-K1-W4", "Rondt de werkzaamheden af", "Completes the work"],
        ["B1-K1-W5", "Evalueert de werkzaamheden", "Evaluates the work"],
        ["P2-K1-W1", "Ondersteunt bij wonen", "Supports with housing and daily living"],
        ["P2-K1-W2", "Ondersteunt bij voeding", "Supports with nutrition"],
        [
          "P2-K1-W3",
          "Ondersteunt bij persoonlijke zorg en ADL",
          "Supports with personal care and activities of daily living",
        ],
        [
          "P2-K1-W4",
          "Assisteert bij het ondernemen van activiteiten gericht op dagbesteding en welbevinden",
          "Assists with activities aimed at day care and well-being",
        ],
      ],
    ),
  },
  {
    value: "mbo-kw-27144",
    label: {
      nl: "Verzorgende IG (niveau 3, crebo 27144)",
      en: "Certified carer, Verzorgende IG (level 3, crebo 27144)",
    },
    opleidingsdomein: "mbo-zorg-welzijn",
    pack: mboPack(
      {
        nl: "Kwalificatiedossier Verzorging en verpleging (crebo 23453), kwalificatie Verzorgende IG (crebo 27144), geldig vanaf 1-8-2026",
        en: "Qualification file Verzorging en verpleging (crebo 23453), qualification Verzorgende IG (crebo 27144), valid from 1-8-2026",
      },
      SBB_VERZORGING_VERPLEGING,
      VV_KERNTAKEN,
      VV_WERKPROCESSEN,
    ),
  },
  {
    value: "mbo-kw-27145",
    label: {
      nl: "Mbo-Verpleegkundige (niveau 4, crebo 27145)",
      en: "Nurse, mbo level (level 4, crebo 27145)",
    },
    opleidingsdomein: "mbo-zorg-welzijn",
    pack: mboPack(
      {
        nl: "Kwalificatiedossier Verzorging en verpleging (crebo 23453), kwalificatie Mbo-Verpleegkundige (crebo 27145), geldig vanaf 1-8-2026",
        en: "Qualification file Verzorging en verpleging (crebo 23453), qualification Mbo-Verpleegkundige (crebo 27145), valid from 1-8-2026",
      },
      SBB_VERZORGING_VERPLEGING,
      [
        ...VV_KERNTAKEN,
        [
          "P2-K1",
          "Organiseert en coördineert de zorgverlening",
          "Organises and coordinates care delivery",
        ],
      ],
      [
        ...VV_WERKPROCESSEN,
        ["P2-K1-W1", "Stelt een verpleegkundige diagnose", "Makes a nursing diagnosis"],
        ["P2-K1-W2", "Coacht en begeleidt collega's", "Coaches and guides colleagues"],
        [
          "P2-K1-W3",
          "Coördineert en optimaliseert de zorgverlening",
          "Coordinates and optimises care delivery",
        ],
      ],
    ),
  },
  {
    value: "mbo-kw-25998",
    label: {
      nl: "Software developer (niveau 4, crebo 25998)",
      en: "Software developer (level 4, crebo 25998)",
    },
    opleidingsdomein: "mbo-ict",
    pack: mboPack(
      {
        nl: "Kwalificatiedossier Software development (crebo 23399), kwalificatie Software developer (crebo 25998), geldig vanaf 1-8-2024",
        en: "Qualification file Software development (crebo 23399), qualification Software developer (crebo 25998), valid from 1-8-2024",
      },
      "https://kwalificatie-mijn.s-bb.nl/Details/DownloadDocument/1963420",
      [
        ["B1-K1", "Realiseert software", "Builds software"],
        ["B1-K2", "Voert ICT-projecten uit", "Carries out ICT projects"],
      ],
      [
        [
          "B1-K1-W1",
          "Stemt opdracht af, plant werkzaamheden en bewaakt de voortgang",
          "Agrees the assignment, plans the work and monitors progress",
        ],
        [
          "B1-K1-W2",
          "Maakt een technisch ontwerp voor software",
          "Makes a technical software design",
        ],
        ["B1-K1-W3", "Realiseert (onderdelen van) software", "Builds (parts of) software"],
        ["B1-K1-W4", "Test software", "Tests software"],
        [
          "B1-K1-W5",
          "Doet verbetervoorstellen voor de software",
          "Proposes improvements to the software",
        ],
        ["B1-K2-W1", "Werkt samen in een projectteam", "Works in a project team"],
        ["B1-K2-W2", "Presenteert het opgeleverde werk", "Presents the delivered work"],
        ["B1-K2-W3", "Evalueert de samenwerking", "Evaluates the collaboration"],
      ],
    ),
  },
];
