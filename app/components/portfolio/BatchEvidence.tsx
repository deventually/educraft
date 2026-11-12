import { useId, useMemo, useRef, useState } from "react";
import { Form, Link } from "react-router";
import { X } from "lucide-react";
import { AiCallField } from "~/components/AiLeaveGuard";
import { FileInput } from "~/components/FileInput";
import { Button, Card, HelpText, Label, Textarea } from "~/components/ui";
import { DOC_ACCEPT_ATTR, DOCX_MIME, fileToText, PDF_MIME } from "~/lib/documents/extract";
import { BATCH_LIMITS, checkNames, type SortProposal } from "~/lib/portfolio/batch";
import { LIMITS } from "~/lib/portfolio/schema";
import type { Outcome } from "~/lib/portfolio/types";
import { fmt } from "~/lib/i18n/format";
import { useT } from "~/lib/i18n/useT";
import { BatchEvidenceList } from "./BatchEvidenceList";

type OutcomeView = Pick<Outcome, "id" | "code" | "title" | "requiredEvidence"> & {
  criteria: { id: string; text: string }[];
};

/** A chosen file: its text stays in this browser until the teacher asks for a proposal. */
interface PickedFile {
  key: string;
  name: string;
  raw: string;
  unreadable: boolean;
}

const ACCEPT = `${DOC_ACCEPT_ATTR},.txt,.md,text/plain,text/markdown`;
const isText = (f: File) => f.type.startsWith("text/") || /\.(txt|md)$/i.test(f.name);
const isDoc = (f: File) =>
  f.type === PDF_MIME || f.type === DOCX_MIME || /\.(pdf|docx)$/i.test(f.name);

/** The file's text, `""` when it could not be read, `null` when it is no PDF, Word or text. */
async function readFile(f: File): Promise<string | null> {
  if (!isText(f) && !isDoc(f)) return null;
  try {
    const text = isText(f) ? await f.text() : (await fileToText(f)).text;
    return text.slice(0, LIMITS.documentText);
  } catch {
    return "";
  }
}

const lines = (s: string) =>
  s
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

/**
 * Evidence in one go: choose many files (or a folder), run the name check per file in the
 * browser, ask for a proposal per file, then confirm in one list (`BatchEvidenceList`).
 */
export function BatchEvidence({
  dossierId = "",
  outcomes,
  room,
  confirmed,
  sorted,
}: {
  dossierId?: string;
  outcomes: OutcomeView[];
  /** How many more evidence items fit in the dossier. */
  room: number;
  confirmed: boolean;
  /** The proposals of the last "Stel voor", by file key. */
  sorted?: SortProposal[];
}) {
  const t = useT().portfolioBatch;
  const [names, setNames] = useState("");
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [clipped, setClipped] = useState(false);
  const counter = useRef(0);
  const ids = {
    names: useId(),
    namesHelp: useId(),
    files: useId(),
    folder: useId(),
    help: useId(),
  };

  const checked = useMemo(() => {
    const list = lines(names);
    return files.map((f) => ({ ...f, ...checkNames(f.raw, list) }));
  }, [files, names]);

  if (!confirmed) {
    return (
      <p className="mt-4 text-sm text-slate-700">
        {t.needsConfirm}{" "}
        <Link
          to={`/portfolio/${dossierId}/framework`}
          className="font-medium text-violet-700 underline underline-offset-2"
        >
          {t.frameworkLink}
        </Link>
      </p>
    );
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const picked = Array.from(input.files ?? []);
    input.value = "";
    const have = new Set(files.map((f) => f.name));
    const added: PickedFile[] = [];
    const skip: string[] = [];
    for (const f of picked) {
      const name = (f.webkitRelativePath || f.name).slice(0, BATCH_LIMITS.name);
      if (have.has(name)) continue;
      const raw = await readFile(f);
      if (raw === null) {
        skip.push(name);
        continue;
      }
      have.add(name);
      counter.current += 1;
      added.push({ key: `f${counter.current}`, name, raw, unreadable: raw.trim() === "" });
    }
    const all = [...files, ...added];
    setClipped(all.length > BATCH_LIMITS.files);
    setFiles(all.slice(0, BATCH_LIMITS.files));
    setSkipped(skip);
  }

  const sendable = JSON.stringify(
    checked.map((f) => ({ key: f.key, name: f.name, text: f.text.slice(0, BATCH_LIMITS.excerpt) })),
  );
  const folder = { webkitdirectory: "", directory: "" } as Record<string, string>;

  return (
    <>
      <Card className="mt-6 p-5">
        <div className="grid gap-4">
          <div>
            <Label htmlFor={ids.names}>{t.namesLabel}</Label>
            <Textarea
              id={ids.names}
              rows={3}
              value={names}
              aria-describedby={ids.namesHelp}
              onChange={(e) => setNames(e.target.value)}
            />
            <HelpText id={ids.namesHelp}>{t.namesHelp}</HelpText>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor={ids.files}>{t.filesLabel}</Label>
              <FileInput
                id={ids.files}
                multiple
                accept={ACCEPT}
                aria-describedby={ids.help}
                onChange={onPick}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor={ids.folder}>{t.folderLabel}</Label>
              <FileInput
                id={ids.folder}
                multiple
                aria-describedby={ids.help}
                onChange={onPick}
                className="mt-1"
                {...folder}
              />
            </div>
          </div>
          <HelpText id={ids.help}>{fmt(t.filesHelp, { n: BATCH_LIMITS.files })}</HelpText>
        </div>

        {skipped.length > 0 && (
          <p className="mt-3 text-sm text-slate-700">
            {fmt(t.skipped, { names: skipped.join(", ") })}
          </p>
        )}
        {clipped && (
          <p className="mt-3 text-sm text-slate-700">{fmt(t.tooMany, { n: BATCH_LIMITS.files })}</p>
        )}

        {checked.length > 0 && (
          <>
            <ul aria-label={t.chosen} className="mt-4 space-y-2">
              {checked.map((f) => (
                <li
                  key={f.key}
                  className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2"
                >
                  <div className="min-w-0 text-sm">
                    <p className="break-all font-medium text-slate-900">{f.name}</p>
                    <p className="text-slate-700">
                      {f.unreadable
                        ? t.unreadable
                        : f.found.length > 0
                          ? fmt(t.found, {
                              items: f.found.map((x) => `${x.original} → [${x.code}]`).join(", "),
                            })
                          : t.clean}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={fmt(t.remove, { name: f.name })}
                    onClick={() => setFiles(files.filter((x) => x.key !== f.key))}
                  >
                    <X className="size-4" aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-slate-700">
              {room === 1 ? t.roomOne : fmt(t.room, { n: room })}
            </p>
            <Form method="post" className="mt-3">
              <input type="hidden" name="intent" value="proposeEvidence" />
              <input type="hidden" name="files" value={sendable} />
              <AiCallField />
              <Button type="submit">{t.propose}</Button>
            </Form>
          </>
        )}
      </Card>

      {sorted && sorted.length > 0 && (
        <BatchEvidenceList outcomes={outcomes} files={checked} sorted={sorted} room={room} />
      )}
    </>
  );
}
