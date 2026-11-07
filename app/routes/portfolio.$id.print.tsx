import { useEffect } from "react";
import { Printer } from "lucide-react";
import type { Route } from "./+types/portfolio.$id.print";
import { Blocks } from "~/components/export/ExportPreview";
import { Button } from "~/components/ui";
import { useT } from "~/lib/i18n/useT";
import { dossierDoc } from "~/lib/portfolio/export";
import { dossierExport } from "~/server/portfolioExport.server";

/**
 * GET /portfolio/:id/print → the dossier (or one outcome, `?lu=`) as a printable page,
 * for "Save as PDF" (like P30.2: no PDF library). Same query and rules as the Word
 * export (`dossierExport`): only the owner, and the final version only without open
 * spots. A draft says CONCEPT at the top and bottom of every printed page and large
 * above the title; open spots are marked.
 */
export async function loader({ request, params }: Route.LoaderArgs) {
  const out = await dossierExport(request, params.id);
  if (out instanceof Response) return out;
  return { doc: dossierDoc(out.input) };
}

export function meta({ loaderData: data }: Route.MetaArgs) {
  return [{ title: data && "doc" in data ? data.doc.title : "LimeOnIt" }];
}

const BANNER = "text-center text-base font-bold uppercase tracking-wide text-red-800";

export default function DossierPrintPage({ loaderData }: Route.ComponentProps) {
  const m = useT().exportResult;
  const { doc } = loaderData as { doc: ReturnType<typeof dossierDoc> };

  useEffect(() => {
    window.print();
  }, []);

  const body = (
    <main className="mx-auto max-w-3xl px-6 py-8 print:max-w-none print:px-0 print:py-4">
      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 print:hidden">
        <Button type="button" size="sm" onClick={() => window.print()}>
          <Printer className="size-4" aria-hidden />
          {m.print}
        </Button>
        <p className="text-sm text-slate-600">{m.printHint}</p>
      </div>
      <div className="export-doc space-y-4 text-base text-slate-900">
        <section className="break-after-page space-y-1 py-12 text-center">
          {doc.banner && (
            <>
              <p className="text-3xl font-bold text-red-800">{doc.banner.text}</p>
              <p className="pb-6 text-red-800">{doc.banner.note}</p>
            </>
          )}
          <h1 className="text-3xl font-semibold">{doc.titlePage.title}</h1>
          {doc.titlePage.lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </section>
        {doc.sections.map((s, i) => {
          const H = s.level === 1 ? "h2" : "h3";
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: sections are static, in order
            <section key={i} className="space-y-2">
              <H className={`font-semibold ${s.level === 1 ? "text-2xl" : "text-xl"}`}>
                {s.heading}
              </H>
              <div className={s.references ? "space-y-1 [&>p]:-indent-8 [&>p]:pl-8" : "space-y-2"}>
                <Blocks blocks={s.blocks} parent={s.level + 1} />
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );

  // A draft: the banner in a table head and foot, which the browser repeats at the top
  // and bottom of every printed page without covering the text. Colours print as shown,
  // so the open spots stay yellow.
  return (
    <div className="min-h-screen bg-white [print-color-adjust:exact]" lang={doc.locale}>
      {doc.banner ? (
        <table role="presentation" className="w-full border-collapse">
          <thead>
            <tr>
              <td data-print-banner="top" className={`${BANNER} border-b-2 border-red-800 py-2`}>
                {doc.banner.text}
              </td>
            </tr>
          </thead>
          <tfoot>
            <tr>
              <td data-print-banner="bottom" className={`${BANNER} border-t-2 border-red-800 py-2`}>
                {doc.banner.text}
              </td>
            </tr>
          </tfoot>
          <tbody>
            <tr>
              <td>{body}</td>
            </tr>
          </tbody>
        </table>
      ) : (
        body
      )}
    </div>
  );
}
