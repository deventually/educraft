import { useEffect, useId, useState } from "react";
import type { ImageInput } from "~/lib/ai/types";
import { documentFigures, type DocFigures } from "~/lib/documents/figures";
import { MAX_IMAGES } from "~/lib/images/process";
import { fmt } from "~/lib/i18n/format";
import { useT } from "~/lib/i18n/useT";

interface Props {
  /** The files uploaded in the source `document` field (stay in the browser). */
  files: File[];
  /** The image field's value: own uploads plus ticked figures. */
  value: ImageInput[];
  onChange: (v: ImageInput[]) => void;
}

const same = (a: ImageInput, b: ImageInput) =>
  a.mediaType === b.mediaType && a.dataBase64 === b.dataBase64;

/**
 * The figures of an uploaded document, each to tick on or off (`InputField.imagesFrom`).
 * Nothing is ticked by default: anonymisation covers text only, so a figure goes
 * to the model only when the teacher chose it.
 */
export function DocumentFigurePicker({ files, value, onChange }: Props) {
  const t = useT();
  const uid = useId();
  const [found, setFound] = useState<DocFigures | null>(null);

  useEffect(() => {
    if (files.length === 0) {
      setFound(null);
      return;
    }
    let live = true;
    setFound(null);
    documentFigures(files)
      .then((result) => live && setFound(result))
      .catch(() => live && setFound({ figures: [], unsupported: 0 }));
    return () => {
      live = false;
    };
  }, [files]);

  if (files.length === 0) return null;

  const full = value.length >= MAX_IMAGES;
  const toggle = (image: ImageInput, on: boolean) =>
    onChange(on ? [...value, image] : value.filter((v) => !same(v, image)));

  return (
    <fieldset className="mt-3 space-y-2 rounded-lg border border-slate-200 p-3">
      <legend className="px-1 text-sm font-medium text-slate-800">{t.tool.figuresLegend}</legend>
      <div aria-live="polite" className="space-y-1 text-xs">
        {!found && <p className="text-slate-600">{t.tool.figuresLoading}</p>}
        {found && found.figures.length === 0 && (
          <p className="text-slate-600">{t.tool.figuresNone}</p>
        )}
        {found && found.unsupported > 0 && (
          <p className="text-slate-600">
            {fmt(t.tool.figuresUnsupported, { count: found.unsupported })}
          </p>
        )}
        {found && found.figures.length > 0 && full && (
          <p className="text-amber-800">{fmt(t.tool.figuresMax, { max: MAX_IMAGES })}</p>
        )}
      </div>
      {found && found.figures.length > 0 && (
        <>
          <p className="rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
            {t.tool.figuresPrivacy}
          </p>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {found.figures.map((fig) => {
              const id = `${uid}-figure-${fig.index}`;
              const checked = value.some((v) => same(v, fig.image));
              const label =
                fig.page === undefined
                  ? fmt(t.tool.figureFromFile, { index: fig.index, source: fig.source })
                  : fmt(t.tool.figureFromPage, { page: fig.page, source: fig.source });
              return (
                <li key={id}>
                  <label
                    htmlFor={id}
                    className="flex cursor-pointer flex-col gap-1 rounded-lg border border-slate-200 p-1.5 text-xs text-slate-700 has-[:checked]:border-violet-500 has-[:checked]:bg-violet-50"
                  >
                    <img
                      src={`data:${fig.image.mediaType};base64,${fig.image.dataBase64}`}
                      alt=""
                      className="aspect-square w-full rounded bg-slate-100 object-contain"
                    />
                    <span className="flex items-start gap-1.5">
                      <input
                        id={id}
                        type="checkbox"
                        className="mt-0.5 focus-visible:ring-2 focus-visible:ring-violet-500"
                        checked={checked}
                        disabled={!checked && full}
                        onChange={(e) => toggle(fig.image, e.target.checked)}
                      />
                      <span>{label}</span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </fieldset>
  );
}
