# Internationalization

Reaching "every country" is **far more than translation**. LimeOnIt separates five
localization layers, in increasing depth. Layers 1–2 exist today; the global
[Vision](../docs/VISION.md) lives in layers 3–5.

---

## The five layers

### 1. UI language (chrome)
The interface itself. Implemented with `app/lib/i18n/messages/{nl,en}.ts`
(nl canonical, `en: Messages` 1:1), a `lang` cookie, `useT()` / `useLocale()`, and a
switcher. Extends from nl/en to N languages.

### 2. Output language (per generation)
**Separate** from the UI language: a teacher can use a Dutch interface and generate
English material, or vice versa. Already a per-generation parameter, injected into
the prompt as `{{outputLanguage}}` by [`buildSystemPrompt`](Architecture.md).

> Keeping UI language and output language independent is a deliberate, already-shipped
> design choice — and a prerequisite for serving multilingual institutions.

### 3. Framework localization
Curriculum standards, qualification descriptors, and level naming per country —
delivered as [framework packs](Context-Model.md#packs). See
[Qualification Frameworks](Qualification-Frameworks.md).

### 4. Pedagogical & cultural norms
Assessment culture, grading scales (1–10 in NL, GPA in the US, percentages in the
UK), feedback directness, individual vs. collective learning norms. These shape *how*
a tool's output should read, not just *what language* it is in.

### 5. Compliance & safeguarding
Data-protection regimes — **GDPR** (EU), **FERPA / COPPA** (US), and minors' data
protection generally. This layer activates by **country + learner age** and matters
most for the **future student-facing tools** (chatbots), far less for today's
instructor generators.

---

## Localization is data, not code

Every layer above is expressed as context data and packs (see
[Context Model](Context-Model.md)). The engine — tools, prompt pipeline, providers —
stays locale-neutral. That is the seam that makes one global app maintainable rather
than N forks (see [Vision §6–8](../docs/VISION.md#6-why-one-app-a-settled-decision)).

## Related

- [Context Model](Context-Model.md) · [Qualification Frameworks](Qualification-Frameworks.md) ·
  [Architecture](Architecture.md)
