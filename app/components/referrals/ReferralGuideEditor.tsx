import { Form } from "react-router";
import { loc } from "~/lib/i18n/localized";
import { useLocale, useT } from "~/lib/i18n/useT";
import { REFERRAL_CAPS, REFERRAL_KINDS, type ReferralGuide } from "~/lib/referrals/guide";
import { Button, HelpText, Input, Label, Textarea } from "~/components/ui";

/**
 * Beheer → Organisatie, the referral guide (P39.4): one group per kind of question with the
 * counter, a short description and a link. Posts `intent=referrals`; the action validates.
 */
export function ReferralGuideEditor({ guide }: { guide: ReferralGuide }) {
  const t = useT();
  const r = t.referrals;
  const locale = useLocale();

  return (
    <section aria-labelledby="referral-guide-heading">
      <h2
        id="referral-guide-heading"
        className="font-display text-lg font-medium tracking-tight text-slate-900"
      >
        {r.editorHeading}
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-slate-600">{r.editorIntro}</p>
      <Form method="post" className="mt-4 space-y-4">
        <input type="hidden" name="intent" value="referrals" />
        {REFERRAL_KINDS.map((k) => {
          const saved = guide.find((e) => e.kind === k.id);
          const id = (field: string) => `referral-${field}-${k.id}`;
          return (
            <fieldset
              key={k.id}
              className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2"
            >
              <legend className="px-1 text-sm font-semibold text-slate-800">
                {loc(k.label, locale)}
              </legend>
              <div>
                <Label htmlFor={id("counter")}>{r.counter}</Label>
                <Input
                  id={id("counter")}
                  name={`counter-${k.id}`}
                  defaultValue={saved?.counter ?? ""}
                  placeholder={loc(k.example, locale)}
                  maxLength={REFERRAL_CAPS.counter}
                  aria-describedby={id("counter-hint")}
                  className="mt-1"
                />
                <HelpText id={id("counter-hint")}>{r.counterHint}</HelpText>
              </div>
              <div>
                <Label htmlFor={id("link")}>{r.link}</Label>
                <Input
                  id={id("link")}
                  name={`link-${k.id}`}
                  type="text"
                  inputMode="url"
                  defaultValue={saved?.link ?? ""}
                  maxLength={REFERRAL_CAPS.link}
                  aria-describedby={id("link-hint")}
                  className="mt-1"
                />
                <HelpText id={id("link-hint")}>{r.linkHint}</HelpText>
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor={id("description")}>{r.description}</Label>
                <Textarea
                  id={id("description")}
                  name={`description-${k.id}`}
                  rows={2}
                  defaultValue={saved?.description ?? ""}
                  maxLength={REFERRAL_CAPS.description}
                  className="mt-1"
                />
              </div>
            </fieldset>
          );
        })}
        <Button type="submit" variant="secondary">
          {r.save}
        </Button>
      </Form>
    </section>
  );
}
