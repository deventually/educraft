import { useEffect, useId, useRef, useState } from "react";
import type { ImageInput } from "~/lib/ai/types";
import { documentFigures, type DocFigure, type DocFigures } from "~/lib/documents/figures";
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

const srcOf = (image: ImageInput) => `data:${image.mediaType};base64,${image.dataBase64}`;

/** One figure at full width, in a modal dialog that closes on Escape or the button. */
function FigureZoom({
  figure,
  label,
  onClose,
}: {
  figure: DocFigure;
  label: string;
  onClose: () => void;
}) {
  const t = useT();
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    }
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="m-auto max-h-[92vh] w-[min(64rem,94vw)] rounded-xl bg-white p-0 shadow-xl backdrop:bg-slate-900/60"
    >
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-2">
        <p className="min-w-0 truncate text-sm font-medium text-slate-800">
          <span id={titleId}>{label}</span>
          <span className="ml-2 font-normal text-slate-600">{figure.source}</span>
        </p>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-md border border-slate-300 px-3 py-1 text-sm text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
        >
          {t.tool.figureClose}
        </button>
      </div>
      <img
        src={srcOf(figure.image)}
        alt={label}
        className="mx-auto max-h-[80vh] w-auto max-w-full object-contain p-4"
      />
    </dialog>
  );
}

/**
 * The figures of an uploaded document, each to tick on or off (`InputField.imagesFrom`).
 * Nothing is ticked by default: anonymisation covers text only, so a figure goes
 * to the model only when the teacher chose it. Clicking a thumbnail enlarges it.
 */
export function DocumentFigurePicker({ files, value, onChange }: Props) {
  const t = useT();
  const uid = useId();
  const [found, setFound] = useState<DocFigures | null>(null);
  const [zoomed, setZoomed] = useState<DocFigure | null>(null);

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
  const labelOf = (fig: DocFigure) =>
    fig.page === undefined
      ? fmt(t.tool.figureFromFile, { index: fig.index })
      : fmt(t.tool.figureFromPage, { index: fig.index, page: fig.page });

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
              const label = labelOf(fig);
              return (
                <li
                  key={id}
                  className="flex min-w-0 flex-col gap-1 rounded-lg border border-slate-200 p-1.5 text-xs text-slate-700 has-[:checked]:border-violet-500 has-[:checked]:bg-violet-50"
                >
                  <button
                    type="button"
                    onClick={() => setZoomed(fig)}
                    aria-label={fmt(t.tool.figureZoom, { label })}
                    className="cursor-zoom-in rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                  >
                    <img
                      src={srcOf(fig.image)}
                      alt=""
                      className="aspect-square w-full rounded bg-slate-100 object-contain"
                    />
                  </button>
                  <label htmlFor={id} className="flex min-w-0 cursor-pointer items-start gap-1.5">
                    <input
                      id={id}
                      type="checkbox"
                      className="mt-0.5 shrink-0 focus-visible:ring-2 focus-visible:ring-violet-500"
                      checked={checked}
                      disabled={!checked && full}
                      aria-describedby={`${id}-source`}
                      onChange={(e) => toggle(fig.image, e.target.checked)}
                    />
                    <span className="min-w-0 [overflow-wrap:anywhere]">{label}</span>
                  </label>
                  <span
                    id={`${id}-source`}
                    title={fig.source}
                    className="block min-w-0 truncate pl-5 text-slate-600"
                  >
                    {fig.source}
                  </span>
                </li>
              );
            })}
          </ul>
          {zoomed && (
            <FigureZoom figure={zoomed} label={labelOf(zoomed)} onClose={() => setZoomed(null)} />
          )}
        </>
      )}
    </fieldset>
  );
}
