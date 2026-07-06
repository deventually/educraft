# Set up your teaching context

A **context profile** describes your teaching situation once, so every tool takes it into account. The profile is passed to each prompt as background (`{{context}}`), so you don't retype it every time.

## One editor, four steps

Go to **Teaching context** and click **New context profile**. There is one clear editor that walks you through everything in four steps — the same editor you later use to **edit** a profile.

1. **Basics** — the **name** (e.g. "Software Engineering — year 2"), the **country**, the **type of education**, and optionally the programme and course.
2. **Level & framework** — the NLQF level (with its derived EU level) and the domain/subject with any national framework.
3. **Context & custom fields** — professional field, technology/methods, educational concept, term for learners, and custom fields.
4. **Finish** — a short summary; optionally set the profile as your default.

## Country → type of education → level

You start with the **country** and **type of education**. The type of education (secondary, senior vocational, higher professional or university — with its track or degree, such as vmbo-kb, havo, mbo-4 or hbo bachelor) drives the rest: it proposes the matching **level** automatically and determines which subjects/domains you can choose.

Level is stored as an **NLQF level** — the Dutch national qualifications framework is the source of truth. The editor shows the **derived EU level (EQF)** next to it and a link to the source ([nlqf.nl](https://nlqf.nl/impact-nlqf/nlqf-niveaus-waaier/)). Important: only that EQF number plus a neutral level directive reaches the prompt — never the term "NLQF" itself. That keeps the engine country-neutral while you choose in familiar Dutch terms. The entry-level (Instroom) option is passed as an entry level, just below EQF 1.

## Framework per domain

When you pick a **domain/subject**, the relevant fields from that domain's national framework appear — today for **hbo** only (for example the hbo-i architecture layers for ICT, the CanMEDS roles for Health & social care, or the HBO-Rechten learning outcomes). Each framework shows its **source**.

For those fields, tick only what your programme actually touches — not the whole framework. For hbo the level starts at the bachelor, and as soon as you pick a **study year** the mastery level is suggested (year 1 → 1, year 4 → 3; middle years → 2).

For **secondary (vo)** and **senior vocational (mbo)** education no national frameworks are built in yet. You'll see plainly that there is no established framework and add the relevant fields yourself — nothing is invented.

## Learner term and educational concept

The term for learners follows automatically from the type of education: in secondary education they are **pupils**, in mbo/hbo/wo **students** (in mbo you can switch to the Dutch *deelnemers*). The teacher is a **teacher**. This way the tools use the right words without you having to adjust anything.

With **Educational concept / didactic approach** you optionally add your pedagogical approach (Montessori, Dalton, Jenaplan, problem-based…). That text is passed verbatim to every prompt.

## Custom fields

With **Custom fields** you add your own name/value pairs per profile. They're passed to every prompt like everything else — handy for specialisations or accents that don't fit a standard framework.

Mark one profile as **default**; it will be pre-selected on the tool pages.

## For admins: defaults and custom access

If you're an **admin**, the **Teaching context** admin page is where you set the defaults for the whole instance: which **countries**, which **types of education**, and — under **Domains / profiles** — which subject areas teachers may choose. Country and type of education always keep at least one choice; leave **Domains / profiles** empty and *all* domains are available.

By default every teacher **inherits** these settings. To give one teacher a different scope, switch on **Activate custom access** for that teacher. Their own selection then **replaces** the instance default entirely — you can allow *more* than the default or fewer. An axis you leave empty means "all"; the instance default no longer counts for that teacher.

Turn **custom access** off again later and the teacher simply inherits the defaults once more. This happens **without any loss**: the choices you saved for that teacher are kept and return the moment you re-activate custom access.

## Why it matters

Without context, a tool produces generic output. With a good profile, the material fits your type of education, level, and field — saving a lot of editing afterwards. You can create several profiles (e.g. one per course) and choose which to use for each generation.
