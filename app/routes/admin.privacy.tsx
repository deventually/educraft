import { useEffect, useRef } from "react";
import { Form, useActionData } from "react-router";
import type { Route } from "./+types/admin.privacy";
import { requireRole } from "~/server/auth.server";
import {
  addSharedKeepWord,
  listKeepWordSuggestions,
  listSharedKeepWords,
  removeSharedKeepWord,
} from "~/server/repositories/sharedKeepWords.server";
import { useFormToast } from "~/components/Toast";
import { fmt } from "~/lib/i18n/format";
import { useT } from "~/lib/i18n/useT";

/**
 * The institution's never-words (anonymiseerpoort PR 5): which words teachers put on their
 * never-list, with how many chose each and never who, and one button to keep a word for everyone.
 * Below it the shared list, with a button to take a word off. The gate and every live preview read
 * the shared list.
 */
export async function loader({ request }: Route.LoaderArgs) {
  await requireRole(request, "admin");
  const [suggestions, shared] = await Promise.all([
    listKeepWordSuggestions(),
    listSharedKeepWords(),
  ]);
  return { suggestions, shared };
}

type Result =
  | { ok: true; intent: "share" | "unshare"; word: string }
  | { ok: false; error: "invalid" | "name" };

export async function action({ request }: Route.ActionArgs): Promise<Result> {
  const admin = await requireRole(request, "admin");
  const fd = await request.formData();
  const intent = fd.get("intent");
  const word = String(fd.get("word") ?? "").slice(0, 200);
  if (intent === "share") {
    const added = await addSharedKeepWord(word, admin.id);
    return added === "added"
      ? { ok: true, intent, word: word.trim() }
      : { ok: false, error: added };
  }
  if (intent === "unshare" && word.trim()) {
    await removeSharedKeepWord(word);
    return { ok: true, intent, word: word.trim() };
  }
  return { ok: false, error: "invalid" };
}

const sectionHeading = "font-display text-lg font-medium tracking-tight text-slate-900";
const button =
  "rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600";

function WordButton(props: {
  intent: "share" | "unshare";
  word: string;
  label: string;
  name: string;
}) {
  return (
    <Form method="post">
      <input type="hidden" name="intent" value={props.intent} />
      <input type="hidden" name="word" value={props.word} />
      <button type="submit" aria-label={props.name} className={button}>
        {props.label}
      </button>
    </Form>
  );
}

export default function AdminPrivacy({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const p = t.adminPrivacy;
  const actionData = useActionData<typeof action>();
  useFormToast(actionData, {
    result: (r) => {
      if (!r) return null;
      if (!r.ok) return { variant: "error", message: p.errors[r.error] };
      return {
        variant: "success",
        message: fmt(r.intent === "share" ? p.shared : p.removed, { word: r.word }),
      };
    },
  });
  const { suggestions, shared } = loaderData;
  // The word's row or chip is gone after an action: focus goes to the heading of its list.
  const suggestionsRef = useRef<HTMLHeadingElement>(null);
  const sharedRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!actionData?.ok) return;
    (actionData.intent === "share" ? suggestionsRef : sharedRef).current?.focus();
  }, [actionData]);

  return (
    <div className="space-y-10">
      <section>
        <h2 className={sectionHeading}>{p.heading}</h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">{p.intro}</p>
      </section>

      <section aria-labelledby="privacy-suggestions">
        <h2 id="privacy-suggestions" ref={suggestionsRef} tabIndex={-1} className={sectionHeading}>
          {p.suggestionsHeading}
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">{p.suggestionsIntro}</p>
        {suggestions.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">{p.suggestionsEmpty}</p>
        ) : (
          <div className="mt-4 max-w-2xl overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">{p.suggestionsCaption}</caption>
              <thead className="border-b border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-semibold">
                    {p.colWord}
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-right font-semibold">
                    {p.colTeachers}
                  </th>
                  <th scope="col" className="px-4 py-2.5">
                    <span className="sr-only">{p.colAction}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {suggestions.map((s) => (
                  <tr key={s.word} className="border-b border-slate-50 last:border-0">
                    <th scope="row" className="px-4 py-2.5 text-left font-medium text-slate-800">
                      {s.word}
                    </th>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">
                      {s.teachers}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <WordButton
                        intent="share"
                        word={s.word}
                        label={p.shareLabel}
                        name={fmt(p.share, { word: s.word })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="privacy-shared">
        <h2 id="privacy-shared" ref={sharedRef} tabIndex={-1} className={sectionHeading}>
          {p.sharedHeading}
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">{p.sharedIntro}</p>
        {shared.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">{p.sharedEmpty}</p>
        ) : (
          <ul aria-labelledby="privacy-shared" className="mt-4 flex max-w-2xl flex-wrap gap-2">
            {shared.map((word) => (
              <li
                key={word}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white py-1 pl-3 pr-1 text-sm"
              >
                <span className="font-medium text-slate-800">{word}</span>
                <WordButton
                  intent="unshare"
                  word={word}
                  label={p.removeLabel}
                  name={fmt(p.remove, { word })}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
