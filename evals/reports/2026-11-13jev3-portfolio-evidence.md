# Eval — bewijs in één keer (portfolio-evidence-sort@v1)

Datum: 2026-11-13 · model: typesafe/jev-1.14 · herhalingen: 3

**Geslaagd: 60/69**

Controleren gezet: 55/69

Snelheid: gemiddeld 274 ms, hoogst 510 ms per bestand · kosten: $0.005214 in totaal

| Case | parse | outcome | kind | criteria | required | doubt | clean | Controleren |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| nl-lesson-plan#1 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nee |
| nl-lesson-plan#2 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nee |
| nl-lesson-plan#3 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nee |
| nl-feedback-supervisor#1 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ja: unsettled:c_U1_2, unsettled:c_U1_4 |
| nl-feedback-supervisor#2 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ja: unsettled:c_U1_2, unsettled:c_U1_4 |
| nl-feedback-supervisor#3 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ja: unsettled:c_U1_2, unsettled:c_U1_3, unsettled:c_U1_4 |
| nl-test-blueprint#1 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nee |
| nl-test-blueprint#2 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nee |
| nl-test-blueprint#3 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nee |
| nl-test-analysis#1 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ja: unsettled:c_U4_1 |
| nl-test-analysis#2 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ja: unsettled:c_U4_1 |
| nl-test-analysis#3 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ja: unsettled:c_U4_1 |
| nl-own-reflection#1 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nee |
| nl-own-reflection#2 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nee |
| nl-own-reflection#3 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ja: unsettled:c_U1_1 |
| nl-ai-output#1 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ja: kind, unsettled:c_U1_3, unsettled:c_U1_4, unsettled:r_U1_1 |
| nl-ai-output#2 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ja: kind, unsettled:c_U1_3, unsettled:c_U1_4, unsettled:r_U1_1 |
| nl-ai-output#3 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ja: kind, unsettled:c_U1_2, unsettled:c_U1_3, unsettled:c_U1_4, unsettled:r_U1_1 |
| nl-no-text#1 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ja: unsettled:c_U4_1, unsettled:r_U4_2, no-text |
| nl-no-text#2 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ja: unsettled:c_U4_1, unsettled:c_U4_2, unsettled:r_U4_2, no-criteria, no-text |
| nl-no-text#3 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ja: unsettled:c_U4_1, unsettled:r_U4_2, no-text |
| nl-injection#1 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ja: unsettled:c_U1_3, unsettled:r_U1_1 |
| nl-injection#2 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ja: unsettled:c_U1_3, unsettled:r_U1_1 |
| nl-injection#3 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ja: unsettled:c_U1_3, unsettled:r_U1_1 |
| nl-template#1 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ja: outcome, unsettled:r_U3_1, no-criteria |
| nl-template#2 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ja: outcome, unsettled:r_U3_1, no-criteria |
| nl-template#3 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ja: outcome, unsettled:r_U3_1, no-criteria |
| nl-names#1 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ja: unsettled:c_U2_1 |
| nl-names#2 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ja: unsettled:c_U2_1 |
| nl-names#3 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ja: unsettled:c_U2_1 |
| nl-folder-misleads#1 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nee |
| nl-folder-misleads#2 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nee |
| nl-folder-misleads#3 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nee |
| en-lesson-plan#1 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ja: unsettled:c_U1_2, unsettled:c_U1_3 |
| en-lesson-plan#2 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ja: unsettled:c_U1_2, unsettled:c_U1_3 |
| en-lesson-plan#3 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ja: unsettled:c_U1_2, unsettled:c_U1_3 |
| en-student-feedback#1 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ja: outcome, unsettled:c_U1_1, unsettled:c_U1_3, no-criteria |
| en-student-feedback#2 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ja: outcome, unsettled:c_U1_1, unsettled:c_U1_3, no-criteria |
| en-student-feedback#3 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ja: outcome, unsettled:c_U1_1, unsettled:c_U1_3, no-criteria |
| nl-hard-two-outcomes#1 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ja: outcome, kind, unsettled:r_U5_1 |
| nl-hard-two-outcomes#2 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ja: outcome, kind, unsettled:r_U5_1 |
| nl-hard-two-outcomes#3 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ja: outcome, kind, unsettled:r_U5_1 |
| nl-hard-ocr#1 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ja: unsettled:c_U1_3 |
| nl-hard-ocr#2 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ja: unsettled:c_U1_3 |
| nl-hard-ocr#3 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ja: unsettled:c_U1_3 |
| nl-hard-long#1 | ✓ | ✓ | ✓ | ✓ | ✓ | × | ✓ | ja: unsettled:c_U4_1, unsettled:c_U4_2, unsettled:r_U4_1 |
| nl-hard-long#2 | ✓ | ✓ | ✓ | ✓ | ✓ | × | ✓ | ja: unsettled:c_U4_1, unsettled:c_U4_2 |
| nl-hard-long#3 | ✓ | ✓ | ✓ | ✓ | ✓ | × | ✓ | ja: unsettled:c_U4_1, unsettled:c_U4_2 |
| nl-hard-english-feedback#1 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ja: unsettled:c_U1_4 |
| nl-hard-english-feedback#2 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ja: unsettled:c_U1_4 |
| nl-hard-english-feedback#3 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ja: unsettled:c_U1_4 |
| nl-hard-filename-only#1 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ja: none, no-text |
| nl-hard-filename-only#2 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ja: none, no-text |
| nl-hard-filename-only#3 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ja: none, no-text |
| nl-hard-transcript#1 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ja: unsettled:c_U1_1 |
| nl-hard-transcript#2 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ja: unsettled:c_U1_1 |
| nl-hard-transcript#3 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ja: unsettled:c_U1_1 |
| nl-hard-development-plan#1 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nee |
| nl-hard-development-plan#2 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nee |
| nl-hard-development-plan#3 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | nee |
| nl-hard-not-evidence#1 | ✓ | ✓ | × | ✓ | ✓ | ✓ | ✓ | ja: none |
| nl-hard-not-evidence#2 | ✓ | ✓ | × | ✓ | ✓ | ✓ | ✓ | ja: none |
| nl-hard-not-evidence#3 | ✓ | ✓ | × | ✓ | ✓ | ✓ | ✓ | ja: none |
| nl-hard-feedback-on-plan#1 | ✓ | ✓ | ✓ | × | ✓ | ✓ | ✓ | ja: unsettled:c_U5_1, unsettled:c_U5_2, unsettled:r_U5_1, no-criteria |
| nl-hard-feedback-on-plan#2 | ✓ | ✓ | ✓ | × | ✓ | ✓ | ✓ | ja: unsettled:c_U5_1, unsettled:c_U5_2, unsettled:r_U5_1, no-criteria |
| nl-hard-feedback-on-plan#3 | ✓ | ✓ | ✓ | × | ✓ | ✓ | ✓ | ja: unsettled:c_U5_1, unsettled:c_U5_2, unsettled:r_U5_1, no-criteria |
| en-hard-dutch-text#1 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ja: unsettled:c_U2_1, unsettled:c_U2_2, unsettled:r_U2_1 |
| en-hard-dutch-text#2 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ja: unsettled:c_U2_1, unsettled:c_U2_2, unsettled:r_U2_1 |
| en-hard-dutch-text#3 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ja: unsettled:c_U2_1, unsettled:c_U2_2, unsettled:r_U2_1 |

- **parse**: 69/69
- **outcome**: 69/69
- **kind**: 66/69
- **criteria**: 66/69
- **required**: 69/69
- **doubt**: 66/69
- **clean**: 69/69
