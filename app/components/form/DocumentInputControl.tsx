import { useCallback, useState } from "react";
import { filesToDocumentText } from "~/lib/documents/extract";
import { useT } from "~/lib/i18n/useT";
import { Button, Spinner, Textarea } from "../ui";

interface DocumentInputControlProps {
  id: string;
  value: string;
  accept: string;
  rows: number;
  placeholder?: string;
  onChange: (v: string) => void;
  onFiles?: (files: File[]) => void;
}

/**
 * A textarea the teacher can fill by uploading PDF/Word file(s) *or* by pasting.
 * Extraction runs in the browser ({@link filesToDocumentText}); only the
 * resulting text is stored, so the value stays a plain string — identical to a
 * textarea field. Multiple files (e.g. a research report + work product for a
 * whole portfolio) can be selected at once and are merged with headings.
 */
export function DocumentInputControl({
  id,
  value,
  accept,
  rows,
  placeholder,
  onChange,
  onFiles,
}: DocumentInputControlProps) {
  const t = useT();
  const fileId = `${id}-file`;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();
  const [skipped, setSkipped] = useState<string[]>([]);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.currentTarget.files ?? []);
      e.currentTarget.value = ""; // allow re-selecting the same file(s)
      if (files.length === 0) return;

      setError(undefined);
      setNotice(undefined);
      setSkipped([]);
      setBusy(true);
      try {
        const { text, emptyFiles, large } = await filesToDocumentText(files);
        if (!text) {
          setNotice(t.tool.docEmpty);
        } else {
          onChange(text);
          setNotice(large ? t.tool.docLarge : t.tool.docExtracted);
        }
        setSkipped(emptyFiles);
        // Even a scan without text is worth showing as the original.
        onFiles?.(files);
      } catch (err) {
        setError(err instanceof Error ? err.message : t.tool.docEmpty);
      } finally {
        setBusy(false);
      }
    },
    [onChange, onFiles, t],
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <input
          id={fileId}
          type="file"
          accept={accept}
          multiple
          className="hidden"
          onChange={handleFileChange}
          aria-label={t.tool.docUpload}
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={busy}
          onClick={() => document.getElementById(fileId)?.click()}
        >
          {busy && <Spinner />}
          {busy ? t.tool.docExtracting : t.tool.docUpload}
        </Button>
      </div>

      <div aria-live="polite">
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {notice && !error && <p className="text-xs text-slate-600">{notice}</p>}
        {skipped.length > 0 && !error && (
          <p className="text-xs text-amber-700">
            {t.tool.docSkippedEmpty}: {skipped.join(", ")}
          </p>
        )}
      </div>

      <Textarea
        id={id}
        rows={rows}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
