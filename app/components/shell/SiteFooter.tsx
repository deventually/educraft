import { Link } from "react-router";
import { ArrowUp } from "lucide-react";
import type { Messages } from "~/lib/i18n/messages/nl";
import { LICENSE_URL } from "~/lib/prompts/attribution";
import { SITE } from "~/lib/site";

export function SiteFooter({
  t,
  portfolio,
  courses,
}: {
  t: Messages;
  portfolio: boolean;
  courses: boolean;
}) {
  // A real website footer: brand + site map columns on a deep evergreen field
  // (one step darker than the brand button green). The book attribution lives in
  // the bottom bar to satisfy CC BY — the prominent link back to the book now
  // sits in each tool's "Rationale & source" panel.
  const columns = [
    {
      heading: t.footer.product,
      links: [
        { to: "/start", label: t.nav.start },
        ...(courses ? [{ to: "/courses", label: t.nav.courses }] : []),
        ...(portfolio ? [{ to: "/portfolio", label: t.nav.portfolio }] : []),
        { to: "/tools", label: t.nav.tools },
        { to: "/projects", label: t.nav.projects },
        { to: "/context-profiles", label: t.nav.settings },
      ],
    },
    {
      heading: t.footer.resources,
      links: [
        { to: "/help", label: t.nav.help },
        { to: "/about", label: t.nav.about },
      ],
    },
    {
      heading: t.footer.legal,
      links: [
        { to: "/legal", label: t.footer.disclaimer },
        { to: "/cookies", label: t.footer.cookies },
      ],
    },
  ];

  return (
    <footer className="border-t border-black/10 bg-violet-700 text-violet-100 print:hidden">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-1">
            <span className="font-display text-xl font-medium text-white">{t.appName}</span>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-violet-200">
              {t.footer.tagline}
            </p>
            <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-violet-200">
              {t.footer.emailLabel}
            </p>
            <a
              href={`mailto:${SITE.contactEmail}`}
              className="mt-1 inline-block text-sm text-violet-100 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-violet-700"
            >
              {SITE.contactEmail}
            </a>
          </div>
          {columns.map((col) => (
            <div key={col.heading}>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-violet-200">
                {col.heading}
              </h2>
              <ul className="mt-3 space-y-2">
                {col.links.map((link) => (
                  <li key={link.to}>
                    <Link
                      to={link.to}
                      className="text-sm text-violet-100 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-violet-700"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-white/10 pt-6 text-xs text-violet-200 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {SITE.year} {t.appName}. {t.footer.rights}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
            <p>
              {t.footer.prompts} <span className="text-violet-100">The Pedagogical Promptbook</span>{" "}
              ({t.footer.by}), {t.footer.licensed}{" "}
              <a
                href={LICENSE_URL}
                className="text-white underline underline-offset-2 hover:no-underline"
                target="_blank"
                rel="noreferrer"
              >
                CC BY 4.0
              </a>
              .
            </p>
            <a
              href="#top"
              className="inline-flex shrink-0 items-center gap-1 text-violet-100 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-violet-700"
            >
              <ArrowUp className="size-3.5" aria-hidden />
              {t.footer.backToTop}
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
