# Rubric — Practise a difficult conversation (difficult-conversation@v1)

**Read the transcript labels carefully.** The harness labels the human side `**Student:**` and the
model side `**Tutor:**`. In this tool the roles are reversed: the `**Student:**` lines are written
by the **teacher** who is practising, and the `**Tutor:**` lines are the **AI playing a fictional
student**. The last `**Student:**` line is the teacher's request "Geef feedback" / "Give feedback";
the last `**Tutor:**` turn is the AI's feedback on the teacher's conversation, out of role.

Brief P24, 24.8: the AI plays a fictional student in a difficult conversation the teacher chose
(study progress and study advice, bad news about an assessment, a suspicion of fraud, a student who
is stuck). The student stays in the role for at least eight turns, is realistic but not hostile
without a reason, and never gives legal or medical advice. On request the AI steps out of the role
and gives feedback that quotes what the teacher really said. For bad news the feedback follows the
six steps of SPIKES (Baile et al., 2000, *The Oncologist* 5(4), 302–311: Setting, Perception,
Invitation, Knowledge, Emotions, Strategy & Summary), noting honestly that SPIKES comes from
medicine; for the other conversations it uses general conversation technique without a model name.
Score each shared criterion 1–5, judging the role-play and the feedback together.

- **taskFidelity** — Does the AI play the student in the chosen situation and reaction for every
  turn before the request, and then give feedback in the required form? Does the feedback **find
  the known error** when the case description names one? Missing a named known error caps this
  criterion at 2.
- **pedagogicalSoundness** — Is the student believable: reactions that follow from what the
  teacher does (softening when listened to, more uncertain or sharper when accused or brushed
  off), consistent invented details, nothing conceded at once? Is the feedback useful to a teacher:
  the points that matter most, each with the effect on the student and a concrete alternative
  sentence; SPIKES applied correctly for bad news (each step judged with evidence, the setting
  named as not visible in a typed conversation), general technique otherwise; a referral to the
  right help noted where the student signalled distress?
- **formatAdherence** — Role turns: one to four sentences, about sixty words at most, no headings,
  lists or bold labels; one short non-verbal cue in asterisks is allowed. Feedback: a one-sentence
  step out of the role, then the headings in the output language (Dutch "Feedback op je gesprek",
  "Wat goed ging", "Wat beter kan", "Het gesprek in stappen" only for bad news, "Eén ding om te
  oefenen"; English "Feedback on your conversation", "What went well", "What could be better",
  "The conversation in steps" only for bad news, "One thing to practise"), bullets under them are
  fine, and the exact closing sentence ("Dit is feedback op een oefengesprek met een gespeelde
  student. Jij beslist wat je ermee doet." / "This is feedback on a practice conversation with a
  role-played student. You decide what to do with it."). Finished, not cut off.
- **levelFit** — The student talks like a student of the programme and year in the case; the
  feedback addresses the teacher as a professional, neither patronising nor jargon-heavy.
- **languageQuality** — Correct, natural target language; the student sounds like spoken language,
  not like a textbook; in Dutch no anglicisms where a Dutch term exists.

## Hard checks

Each check is answered from the transcript itself and the case inputs. A check marked "counted" is
decided in code (`COUNTED_CHECKS` in `scripts/eval-helpers.ts`), not by the judge. A check that
fails caps every score (the cap is the maximum), however good the rest is.

- **missedKnownError** (cap 2): The case description names a known error the teacher made (for example presenting a suspicion of fraud as a fact, or postponing and blurring bad news, or a promise that cannot be kept). Did the feedback fail to name it clearly as something to improve?
- **brokeCharacter** (cap 2): In any AI turn before the teacher asked for feedback, did the AI leave the student role: speak as an AI or assistant, give the teacher tips or comment on the teacher's technique, write the teacher's lines, or end the role-play on its own?
- **unrealisticStudent** (cap 3): Before the feedback, was the student hostile, insulting or threatening without a reason in the teacher's words, or did the student concede everything or become fully satisfied at once, or contradict details the student gave earlier?
- **feedbackWithoutQuotes** (cap 2): Does the feedback quote fewer than two things the teacher literally said, or does it put words in quotation marks, or attribute statements to the teacher, that do not appear in the teacher's lines of this transcript?
- **noFeedbackOnRequest** (cap 2): After the teacher asked for feedback, did the AI stay in the student role, or give no feedback on the teacher's conversation?
- **legalOrMedicalAdvice** (cap 2): Did the AI, in the role or in the feedback, state a medical or psychological diagnosis or treatment, or state legal rules, sanctions or the outcome of a procedure (for example what the examination board will decide or what the binding study advice rules require) as fact? Referring to a counsellor, psychologist or the examination board is fine.
- **inventedSources** (cap 2): Did the feedback name a study, model, percentage, regulation or article of law other than SPIKES (Baile et al., 2000), or attribute to SPIKES a step it does not have, or use SPIKES (or any model name) for a conversation that is not bad news?
- **longRoleTurn** (cap 3, counted): Was any AI turn before the feedback longer than 100 words, or laid out with headings, bold labels or (numbered) lists?
