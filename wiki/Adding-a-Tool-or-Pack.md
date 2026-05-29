# Adding a Tool or Pack

EduCraft is designed to be extended by **authoring data**, not writing features. The
two main extension points are **tools** and **packs**.

See [Architecture](Architecture.md) for the underlying model.

---

## Add a tool

A tool = an evidence-based method + an evaluated prompt, expressed as a `Tool` plus a
`PromptDef`.

1. **Write the prompt files** —
   `app/lib/prompts/files/<id>.nl.md` and `<id>.en.md`, using `{{placeholders}}` for
   every context-driven value.
2. **Create the `PromptDef`** — `app/lib/prompts/<id>.prompt.ts`, holding the
   **verbatim** original (shown in the UI for CC BY fidelity) and the **runtime**
   prompt reference. Register it in `app/lib/prompts/index.ts` (the `PROMPTS` map).
3. **Define the `Tool`** — `app/lib/registry/tools/<id>.ts`: declare `inputs`
   (fields → auto-rendered form) and `stages[]` (one stage for a one-shot generator;
   multiple chained stages with `consumes` for a pipeline like the Cognitive
   Architect).
4. **Register the tool** — add it to `app/lib/registry/index.ts`.
5. **Validate** — `npm test`. `validate.ts` checks that **every `{{placeholder}}`
   has a source** and that localized fields are well-formed.

> Keep displayed strings as `LocalizedText` (`{ nl, en }`); keep option *values* as
> stable English slugs (they flow into the prompt text), while *labels* stay
> bilingual. See `app/lib/i18n/localized.ts`.

---

## Add a pack

A **pack** is locale- or domain-specific data that plugs into the engine without
changing it. The **hbo-i (ICT) pack** is the working prototype — copy its shape.

- **Domain pack** — subject-specific structure (like hbo-i's architectuurlagen /
  activiteiten / niveau), shown conditionally (hbo-i appears when `domain === "ICT"`).
  Lives alongside `app/lib/context/`.
- **Framework pack** — a country + sector + level's curriculum standards and
  qualification descriptors. See [Qualification Frameworks](Qualification-Frameworks.md)
  for what each target country needs.

**Guiding rule:** the engine must stay locale-neutral. If you find yourself adding a
country- or sector-specific branch in core code, that data belongs in a pack instead.
See [Context Model](Context-Model.md#packs).

---

## Checklist

- [ ] Prompt files for each supported language, all placeholders sourced.
- [ ] `PromptDef` registered in `prompts/index.ts`.
- [ ] `Tool` registered in `registry/index.ts`.
- [ ] Displayed text localized; option values are stable slugs.
- [ ] `npm test` · `npm run typecheck` · `npm run lint` all green.

## Related

- [Architecture](Architecture.md) · [Tools](Tools.md) · [Context Model](Context-Model.md)
