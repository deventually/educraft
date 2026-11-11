---
name: release
description: >-
  Prepare a LimeOnIt release: collect what was merged since the last tag, run the release
  checklist (CI, audit, security and accessibility reviews, prompts and evals, model prices, migrations, settings, privacy), pick
  the SemVer number, write the RELEASE.md entry in plain Dutch and open the "Release X.Y.Z"
  PR. Never sets the tag itself. Triggers: "release", "maak een release", "nieuwe versie",
  "uitrollen", "release notes".
---

# Release — from main to a tag Bastiaan sets

A release is a git tag `vX.Y.Z` on `main` (BESLUIT-2026-11-11-5). This skill prepares
everything up to the tag; **Bastiaan sets the tag and rolls out**. Claude sessions may not run
`git tag`, `git push --tags` or `gh release` (`.claude/settings.json`), and must not try a way
around that.

What happens after the tag is automatic: `.github/workflows/release.yml` checks that the tag,
`package.json` and `RELEASE.md` agree, pushes the image to
`ghcr.io/deventually/educraft:X.Y.Z` and makes the GitHub Release. Rolling out is
`./deploy.sh X.Y.Z` on the VPS (`docs/overdracht.md`, section 3).

Read `docs/fabriek/voorkeuren.md` first; it wins over this file. Talk to Bastiaan in Dutch.

## 1. What changed since the last release

```bash
git fetch origin main --tags
LAST=$(git describe --tags --abbrev=0 --match 'v*' origin/main 2>/dev/null || echo "")
RANGE=${LAST:+$LAST..}origin/main
git log --format='%h %s' $RANGE                          # merged PRs (squash: "(#123)")
git diff --name-only --diff-filter=A $RANGE -- drizzle/   # new migrations
git diff $RANGE -- .env.example                          # new or changed settings
git diff --name-only $RANGE -- app/lib/prompts/           # prompts, new @vN files
```

No tag yet means this is the first release: summarise from `docs/fabriek/STATUS.md` (*Nu*)
instead of listing every PR.

## 2. The checklist

Check each item yourself and put the result in the PR body as a ticked or open box, with what
you saw (a link, a count, a command's output). An open box is fine if you say why; a box you
did not check is not ticked.

**Code and security**
- [ ] The latest runs on `main` of **CI** (gate, e2e, audit) and **CodeQL** are green (GitHub
      MCP: list the workflow runs for `main`).
- [ ] `npm audit --omit=dev --audit-level=moderate` is clean.
- [ ] The latest nightly **Mutation testing** run is green (Stryker breaks below 70%). Note its
      score.
- [ ] `/security-review` over everything since the last tag (`git diff $RANGE`). Note what it
      found; a real finding gets fixed before the release, not after.
- [ ] `/accessibility-review` of every screen whose components or routes changed since the last
      tag. Note what it found and what it could not check (no real screen reader).
- [ ] No open Dependabot PR is half done. If there are many, say so and suggest
      `/maintenance` first.

**Prompts and models**
- [ ] Every prompt that got a new `@vN` since the last tag has a fresh report in
      `evals/reports/`. If one is missing: list the evals to run (`npm run eval*`, see
      `evals/README.md`) and **ask Bastiaan before running them** — they cost API credit.
- [ ] `/model-prices` ran in the last month and no model in `config/models.json` is retired
      or about to be by its provider. If it is older, say so; run it only if Bastiaan agrees.

**Data and rollout**
- [ ] Migrations since the last tag: list them. With a migration, rolling back needs the
      database back too; RELEASE.md says so.
- [ ] Every new or changed setting in `.env.example` is in RELEASE.md, with what to fill in on
      the server.
- [ ] A new AI provider or other external service? Then `wiki/Compliance.md` needs it, and
      Bastiaan decides (privacy is his call). Flag it; do not decide.
- [ ] `docker-compose.yml` and `deploy/docker-compose.yml` name no floating image tag of ours.

**For Bastiaan** (leave these open in the PR; they are his)
- [ ] Read the release notes: is what changes for a teacher right?
- [ ] After `./deploy.sh`: the smoke checklist in `wiki/Deployment.md`.
- [ ] Anything pilot teachers should hear? A message to them always goes through him.

## 3. The version number

SemVer, judged from what someone who installs LimeOnIt has to do (rules in `RELEASE.md`):

- **Major** — a manual step before the new version works (a new required setting, a changed
  volume or port).
- **Minor** — anything new for teachers or admins. An automatic migration is still minor.
- **Patch** — fixes only.

The first release is `1.0.0`. Propose the number with one sentence of reasoning; Bastiaan may
choose another.

## 4. The RELEASE.md entry

Add it at the top, under the intro, in exactly this form (the workflow refuses anything else):

```markdown
## [1.3.0] - 2026-11-20

**Voor docenten**
- …

**Voor beheer**
- …

**Op de server**
- Migratie: ja/nee. Terugrollen: `./deploy.sh 1.2.0 --restore <back-up>` / `./deploy.sh 1.2.0`.
- Nieuwe instellingen: … (of: geen)
```

Plain Dutch, as `voorkeuren.md` asks: what changes for a teacher, not how. Leave out a group
that has nothing. The date is the day you expect the tag; the release PR can update it.

## 5. The release PR

```bash
git checkout -B <your branch> origin/main
npm version X.Y.Z --no-git-tag-version   # package.json and package-lock.json, no tag
# edit RELEASE.md
npm test && npm run typecheck && npm run check
```

`tests/deploy/release.test.ts` checks that `package.json` equals the newest RELEASE.md entry.
Open the PR as **"Release X.Y.Z"**, following `.github/pull_request_template.md`, with the
checklist from step 2 in the body. Do not touch `STATUS.md` (project rule).

## 6. Hand over to Bastiaan

When the PR is green, tell him in Dutch, in a few lines:

1. Merge the PR.
2. Set the tag on that merge: `git tag vX.Y.Z origin/main && git push origin vX.Y.Z`, or in
   GitHub under *Releases → Draft a new release* with a new tag on `main`.
3. Wait for the *Release* workflow (a few minutes), then on the VPS: `./deploy.sh X.Y.Z`.
4. Walk the smoke checklist. `deploy.sh` prints the rollback command.
