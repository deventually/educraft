import { type ReactNode, useCallback, useState } from "react";
import type { ImageInput } from "~/lib/ai/types";
import type { FormValues } from "~/lib/forms/values";
import { fmt } from "~/lib/i18n/format";
import { useT } from "~/lib/i18n/useT";
import { filesToImageInputs } from "~/lib/images/process";
import { Label } from "../ui";

interface ImageInputControlProps {
  id: string;
  value: ImageInput[];
  accept: string;
  onChange: (v: ImageInput[]) => void;
  label: string;
  required?: boolean;
  /**
   * Images picked from elsewhere (the figures of an uploaded document), shown first;
   * an own upload then becomes the fallback for what is missing there.
   */
  picked?: ReactNode;
}

export function ImageInputControl({
  id,
  value,
  accept,
  onChange,
  label,
  required,
  picked,
}: ImageInputControlProps) {
  const t = useT();
  const [error, setError] = useState<string | undefined>();

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.currentTarget.files ?? []);
      if (files.length === 0) return;

      try {
        setError(undefined);
        const newImages = await filesToImageInputs(files, accept);
        onChange([...value, ...newImages]);
        // Reset input after successful upload
        const input = document.getElementById(id) as HTMLInputElement;
        if (input) input.value = "";
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to process images";
        setError(message);
        console.warn("Image upload validation failed:", message);
      }
    },
    [value, accept, onChange, id],
  );

  const handleRemove = useCallback(
    (index: number) => {
      onChange(value.filter((_, i) => i !== index));
    },
    [value, onChange],
  );

  return (
    <div className="space-y-3">
      <Label required={required} htmlFor={id} className="mb-1.5">
        {label}
      </Label>

      {picked}

      {/* File input (visually hidden, triggered by button) */}
      <input
        id={id}
        type="file"
        accept={accept}
        multiple
        className="hidden"
        onChange={handleFileChange}
        aria-label={t.tool.imageUploadLabel}
      />

      {/* Upload button */}
      <label htmlFor={id} className="block">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            const input = document.getElementById(id) as HTMLInputElement;
            input?.click();
          }}
          className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-center text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2"
        >
          {picked ? t.tool.figuresOwnUpload : t.tool.imageUploadLabel}
        </button>
      </label>

      {/* Error message */}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {/* Preview grid */}
      {value.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {value.map((img, i) => (
            <div
              key={img.dataBase64.slice(0, 32)}
              className="group relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
            >
              {/* Thumbnail */}
              <img
                src={`data:${img.mediaType};base64,${img.dataBase64}`}
                alt={`Preview ${i + 1}`}
                className="h-full w-full object-cover"
              />

              {/* Remove button overlay */}
              <button
                type="button"
                onClick={() => handleRemove(i)}
                className="absolute inset-0 flex items-center justify-center bg-black/0 transition-all group-hover:bg-black/50 focus-visible:bg-black/50"
                title={t.tool.imageRemove}
                aria-label={`${t.tool.imageRemove} image ${i + 1}`}
              >
                <span className="rounded-full bg-white px-3 py-1 text-sm font-medium text-slate-900 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                  {t.tool.imageRemove}
                </span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Image count indicator */}
      {value.length > 0 && (
        <p className="text-xs text-slate-600">{fmt(t.tool.imageCount, { count: value.length })}</p>
      )}
    </div>
  );
}

/** An image field's value; a fresh form seeds every field with "". */
export function asImages(value: FormValues[string] | undefined): ImageInput[] {
  return Array.isArray(value) ? (value as unknown as ImageInput[]) : [];
}
