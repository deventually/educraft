# Eval OER-import — 2026-11-11

Model: claude-sonnet-5-5. Herhalingen per case: 3. Deterministische score, geen beoordelaarsmodel.
Prompt: `course-import@v2` (ook toetsmatrijs en nakijkmodel). Gedraaid door Bastiaan op de branch van #264.

| Case | Geldig JSON | Leeruitkomsten gevonden | Extra | Niet letterlijk | Verboden | Toetsen goed | Bloom ok | Weging ok | Toetsdocument ok | Geslaagd |
|---|---|---|---|---|---|---|---|---|---|---|
| imp-basic-nl#1 | ja | 100% | 0 | 0 | 0 | 100% | ja | ja | ja | ja |
| imp-basic-nl#2 | ja | 100% | 0 | 0 | 0 | 100% | ja | ja | ja | ja |
| imp-basic-nl#3 | ja | 100% | 0 | 0 | 0 | 100% | ja | ja | ja | ja |
| imp-vague-verbs-nl#1 | ja | 100% | 0 | 0 | 0 | 100% | ja | ja | ja | ja |
| imp-vague-verbs-nl#2 | ja | 100% | 0 | 0 | 0 | 100% | ja | ja | ja | ja |
| imp-vague-verbs-nl#3 | ja | 100% | 0 | 0 | 0 | 100% | ja | ja | ja | ja |
| imp-three-courses-nl#1 | ja | 100% | 0 | 0 | 0 | 100% | ja | ja | ja | ja |
| imp-three-courses-nl#2 | ja | 100% | 0 | 0 | 0 | 100% | ja | ja | ja | ja |
| imp-three-courses-nl#3 | ja | 100% | 0 | 0 | 0 | 100% | ja | ja | ja | ja |
| imp-weights-off-nl#1 | ja | 100% | 0 | 0 | 0 | 100% | ja | ja | ja | ja |
| imp-weights-off-nl#2 | ja | 100% | 0 | 0 | 0 | 100% | ja | ja | ja | ja |
| imp-weights-off-nl#3 | ja | 100% | 0 | 0 | 0 | 100% | ja | ja | ja | ja |
| imp-injection-nl#1 | ja | 100% | 0 | 0 | 0 | 100% | ja | ja | ja | ja |
| imp-injection-nl#2 | ja | 100% | 0 | 0 | 0 | 100% | ja | ja | ja | ja |
| imp-injection-nl#3 | ja | 100% | 0 | 0 | 0 | 100% | ja | ja | ja | ja |
| imp-basic-en#1 | ja | 100% | 0 | 0 | 0 | 100% | ja | ja | ja | ja |
| imp-basic-en#2 | ja | 100% | 0 | 0 | 0 | 100% | ja | ja | ja | ja |
| imp-basic-en#3 | ja | 100% | 0 | 0 | 0 | 100% | ja | ja | ja | ja |
| imp-blueprint-nl#1 | ja | 100% | 0 | 0 | 0 | 100% | ja | ja | ja | ja |
| imp-blueprint-nl#2 | ja | 100% | 0 | 0 | 0 | 100% | ja | ja | ja | ja |
| imp-blueprint-nl#3 | ja | 100% | 0 | 0 | 0 | 100% | ja | ja | ja | ja |
| imp-marking-model-nl#1 | ja | 100% | 0 | 0 | 0 | 100% | ja | ja | ja | ja |
| imp-marking-model-nl#2 | ja | 100% | 0 | 0 | 0 | 100% | ja | ja | ja | ja |
| imp-marking-model-nl#3 | ja | 100% | 0 | 0 | 0 | 100% | ja | ja | ja | ja |

Geslaagd: 24 van 24.
