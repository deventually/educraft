# LimeOnIt Wiki

Welcome to the LimeOnIt project wiki — the living knowledge base for what LimeOnIt
is, how it is built, and where it is going.

> **LimeOnIt in one line:** a *pedagogy compiler* — turn evidence-based teaching
> methods into ready-to-use learning designs for **any level (EQF 1–8), any sector,
> any country, any language**.

For the full strategic picture, read the [Vision](../docs/VISION.md).

---

## Start here

| Page | What it covers |
|------|----------------|
| [Vision](../docs/VISION.md) | The long-term ambition: one universal app across levels, sectors, and countries. |
| [Architecture](Architecture.md) | Stack, the "tools are data" model, prompt pipeline, providers, repo map. |
| [Tools](Tools.md) | The current tool catalog, the stage model, and what's planned. |
| [Context Model](Context-Model.md) | The orthogonal context dimensions and the pack system. |
| [Qualification Frameworks](Qualification-Frameworks.md) | EQF/ISCED + national frameworks per target country. |
| [Internationalization](Internationalization.md) | The five localization layers; UI vs output language; compliance. |
| [Roadmap](Roadmap.md) | Phased path from today's MVP to the global vision. |
| [Adding a Tool or Pack](Adding-a-Tool-or-Pack.md) | How to extend LimeOnIt. |
| [Glossary](Glossary.md) | EQF, ISCED, hbo-i, ARCS-V, backward design, "pack", and more. |

---

## Status snapshot

- **Today:** Netherlands · hbo · Dutch/English UI · 4 instructor generators.
- **Source material:** *The Pedagogical Promptbook* (David Wiley, ed. — CC BY 4.0,
  DOI 10.59668/2340).
- **Stack:** React Router 7 (SSR) · TypeScript · Tailwind v4 · SQLite (Drizzle) ·
  multi-provider AI (Anthropic default, local & CLI providers wired).
- **Decided:** **one app, not many** — see [Vision §6](../docs/VISION.md#6-why-one-app-a-settled-decision).

---

## Conventions for this wiki

- Pages are plain Markdown; link between them with relative links, e.g.
  `[Architecture](Architecture.md)`.
- Keep [the Vision](../docs/VISION.md) as the *aspirational* source of truth and the
  [README](../README.md) as the *current-state* source of truth. Wiki pages explain,
  connect, and go deeper — they should not contradict either.
- This is a living document. When something changes in the code or the plan, update
  the relevant page.
