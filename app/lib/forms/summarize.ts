import type { Locale } from "~/lib/i18n";
import { loc } from "~/lib/i18n/localized";
import type { InputField } from "~/lib/registry/types";
import type { FormValues } from "./values";

/** One entered sandbox setting, ready to render as a "Label: value" chip. */
export interface SandboxSummaryItem {
  name: string;
  label: string;
  value: string;
}

const MAX_LEN = 80;

function truncate(text: string): string {
  const trimmed = text.trim();
  return trimmed.length > MAX_LEN ? `${trimmed.slice(0, MAX_LEN - 1)}…` : trimmed;
}

/**
 * Human-readable summary of the values a user entered in a chat tool's one-time
 * sandbox, so the chat screen can show *what settings it's running with*.
 * Selects/multiselects resolve to their localized option labels; empty fields
 * are omitted; long free text is truncated.
 */
export function summarizeSandbox(
  fields: InputField[],
  values: FormValues,
  locale: Locale,
): SandboxSummaryItem[] {
  const items: SandboxSummaryItem[] = [];

  for (const field of fields) {
    const raw = values[field.name];
    const label = loc(field.label, locale);
    let value = "";

    switch (field.kind) {
      case "select": {
        const opt = field.options?.find((o) => o.value === raw);
        value = opt ? loc(opt.label, locale) : typeof raw === "string" ? raw : "";
        break;
      }
      case "multiselect": {
        if (Array.isArray(raw)) {
          value = (raw as unknown[])
            .map((v) => {
              const opt = field.options?.find((o) => o.value === v);
              return opt ? loc(opt.label, locale) : String(v);
            })
            .join(", ");
        }
        break;
      }
      case "boolean":
        // Only surface an explicit "on"; "off" is the silent default.
        if (raw === true) value = "✓";
        break;
      case "image": {
        const count = Array.isArray(raw) ? raw.length : 0;
        if (count > 0) value = String(count);
        break;
      }
      case "number":
        if (raw !== "" && raw !== undefined && raw !== null) value = String(raw);
        break;
      default:
        // text, textarea, document, file — plain strings.
        if (typeof raw === "string") value = truncate(raw);
        break;
    }

    if (value) items.push({ name: field.name, label, value });
  }

  return items;
}
