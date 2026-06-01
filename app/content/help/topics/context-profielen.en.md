# Setting your teaching context

A **context profile** describes your teaching situation once, so every tool takes it into account. The profile is passed to each prompt as background (`{{context}}`), so you don't retype it every time.

## Creating a profile

Go to **Teaching context**. No profile is set up by default — you create one the way you prefer:

- **Use the wizard** — step by step, with guidance and recommended fields per domain.
- **Fill it in yourself** — all fields on one page.

Both ask for the same things:

- **Name** — e.g. "Software Engineering — year 2".
- **Programme, course, study year, EQF level** — set the tone and level of the output.
- **Target competencies / learning outcomes** — what the teaching steers towards.
- **Professional field** — the field of work you prepare students for.

## Domain framework per domain

When you pick a **domain/sector**, the relevant fields from that domain's national framework appear — for example the hbo-i architecture layers for ICT, the CanMEDS roles for Health & social care, or the HBO-Rechten learning outcomes. Each framework shows its **source**.

For those fields, tick only what your programme actually touches — for a Software Engineering course, say, the *Software* layer and the *Design* and *Realisation* activities, not the whole framework. The framework lists every dimension of the domain, but a course usually touches only a few; ticking what doesn't apply dilutes the context and gives the tools a vaguer picture. EQF defaults to 6 (hbo bachelor), and as soon as you pick a **study year** the mastery level is suggested (year 1 → 1, year 4 → 3; middle years → 2). Adjust or remove any field.

If a domain has no nationally established framework (such as Agro or Other), you'll see that stated plainly and can add the relevant fields yourself.

## Custom fields

With **Custom fields** you add your own name/value pairs per profile. They're passed to every prompt like everything else — handy for specialisations or accents that don't fit a standard framework.

Mark one profile as **default**; it will be pre-selected on the tool pages.

## Why it matters

Without context, a tool produces generic output. With a good profile, the material fits your programme, level, and field — saving a lot of editing afterwards. You can create several profiles (e.g. one per course) and choose which to use for each generation.
