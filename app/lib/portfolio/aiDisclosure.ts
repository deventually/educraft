/**
 * The AI-use disclosure for the export (brief P25, 25.1/25.5). Built from the
 * dossier's own `aiLog`, no LLM. It states what happened, factually; the teacher
 * decides whether it goes into the export and may edit it in Word.
 */
import { resolveModelInfo } from "~/lib/ai/models";
import type { Locale } from "~/lib/i18n";
import type { DossierData } from "./types";

function modelName(id: string): { name: string; publisher?: string } {
  try {
    const info = resolveModelInfo(id);
    return {
      name: info.displayName,
      publisher: info.provider === "anthropic" ? "Anthropic" : undefined,
    };
  } catch {
    return { name: id };
  }
}

const TEXT = {
  nl: {
    review:
      "Bij het schrijven van dit verslag heb ik {models} gebruikt via LimeOnIt, als coach: het gaf feedback op mijn hoofdstukken aan de hand van de criteria van het beoordelingsformulier.",
    draft:
      "Bij {outcomes} liet ik een eerste versie van een alinea opstellen, met mijn eigen bewijs als enige bron. Die tekst heb ik daarna zelf bewerkt.",
    close:
      "De keuzes, de inhoud en de eindtekst zijn van mij; ik heb de feedback zelf afgewogen. De verantwoordelijkheid voor de tekst ligt bij mij.",
    and: " en ",
  },
  en: {
    review:
      "While writing this report I used {models} through LimeOnIt as a coach: it gave feedback on my chapters against the criteria of the assessment form.",
    draft:
      "For {outcomes} I had a first version of a paragraph drafted, with my own evidence as the only source. I then edited that text myself.",
    close:
      "The choices, the content and the final text are mine; I weighed the feedback myself. I am responsible for the text.",
    and: " and ",
  },
} as const;

function list(items: string[], and: string): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")}${and}${items[items.length - 1]}`;
}

/** The disclosure paragraph plus APA references for the models, or `null` if AI was never used. */
export function aiDisclosure(d: DossierData, locale: Locale): string | null {
  if (d.aiLog.length === 0) return null;
  const t = TEXT[locale];
  const models = [...new Set(d.aiLog.map((e) => e.model))].map(modelName);
  const drafted = [...new Set(d.aiLog.filter((e) => e.action === "draft").map((e) => e.outcomeId))]
    .map((id) => d.framework.outcomes.find((o) => o.id === id))
    .flatMap((o) => (o ? [[o.code, o.title].filter(Boolean).join(" ")] : []));
  const year = new Date(Math.max(...d.aiLog.map((e) => e.at))).getUTCFullYear();

  const paragraph = [
    t.review.replace(
      "{models}",
      list(
        models.map((m) => m.name),
        t.and,
      ),
    ),
    drafted.length ? t.draft.replace("{outcomes}", list(drafted, t.and)) : null,
    t.close,
  ]
    .filter(Boolean)
    .join(" ");
  const references = models.map((m) =>
    m.publisher
      ? `${m.publisher}. (${year}). ${m.name} [Large language model]. https://www.anthropic.com/claude`
      : `${m.name} [Large language model]. (${year}).`,
  );
  return [paragraph, ...references].join("\n\n");
}
